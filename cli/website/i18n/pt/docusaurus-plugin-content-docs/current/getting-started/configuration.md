---
sidebar_position: 3
title: "Configuração"
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Configuração

Champollion funciona sem configuração — ele detecta automaticamente arquivos de locale, formato e idiomas de destino do seu projeto. Para mais controle, crie `champollion.config.json` na raiz do seu projeto, ou execute:

```bash
npx champollion init
```

## Referência Completa de Configuração

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "localesPattern": null,
  "localesLayout": null,
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.8-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "genderGuidance": null,
  "protectedTerms": [],
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[typegen ainda não foi implementado]
O bloco de configuração `typegen` é reconhecido e preservado pelo carregador de configuração, mas a geração de tipos TypeScript ainda não foi implementada. Este é um espaço reservado para um recurso planejado. Definir esses valores não tem efeito.
:::


### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|---------|-------------|
| `version` | `number` | `3` | Versão do esquema de configuração. Sempre `3`. |
| `inputLocale` | `string` | `"en"` | Código do idioma de origem (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Caminho para os arquivos de locale. Contém um arquivo por idioma (`fr.json`) ou uma pasta por idioma (`fr/common.json`). Veja [Estruturas de arquivos de locale](#locale-layouts). |
| `localesPattern` | `string` | `null` | Onde os arquivos de cada idioma ficam quando nenhuma das estruturas se encaixa, com `{lang}` e um `{ns}` opcional: `"public/locales/{lang}/{ns}.json"`, `"src/strings/app_{lang}.json"`. Relativo à raiz do projeto. Substitui `localesDir`. Veja [Estruturas de arquivos de locale](#locale-layouts). |
| `localesLayout` | `string` | `null` | Substitui a detecção de estrutura: `"flat"` (um arquivo por idioma) ou `"dir"` (uma pasta por idioma). Necessário apenas quando ambos `en.json` e `en/` existirem. |
| `defaultNamespace` | `string` | `null` | Em um projeto de pasta por idioma com vários arquivos, o arquivo ao qual `champollion wrap` adiciona novas chaves (por exemplo, `"common"`). |
| `contentDir` | `string` | `null` | Uma pasta de Markdown/MDX para traduzir: uma pasta `content/` do Hugo ou qualquer outra pasta, como `./newsletters` em um app Next.js. Cada tradução é gravada ao lado de seu arquivo de origem como `<name>.<locale>.md`, por exemplo `2026-10.md` → `2026-10.crk.md`. Arquivos já nomeados como `<name>.<code>.md` são tratados como traduções, não fontes. Veja [Tradução de conteúdo](/docs/guides/content-translation). |
| `translatableFields` | `string[]` | `null` | Substitui os campos padrão de frontmatter traduzíveis para tradução de conteúdo. `null` usa os padrões integrados (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Formato do arquivo: `json`, `toml`, `yaml`, `po` ([gettext](#gettext)), `arb` ([Flutter](#arb)) ou `auto` (detecta a partir da extensão do arquivo de origem; `.yml` conta como YAML e os destinos mantêm `.yml`). Qualquer outro valor é interrompido com um erro. |
| `model` | `string` | `"google/gemini-3.8-flash"` | Modelo padrão para métodos LLM. Um slug de modelo exato: o slug completo do OpenRouter (`provider/model`). Aliases curtos (`gemini-flash`) e IDs dinâmicos (`~vendor/…`, `…-latest`) são recusados, indicando o slug a ser escrito. Provedores diretos usam nomes simples (por exemplo, `gpt-4o`); um slug do OpenRouter de seu próprio fornecedor é mapeado para ele (`openai/gpt-4o` → `gpt-4o`), e um para o qual não haja modelo interrompe a execução antes que qualquer coisa seja enviada ([Nomes de modelos](/docs/guides/translation-methods#model-names)). |
| `temperature` | `number` | `0.3` | Temperatura do LLM (0.0–2.0). Mais baixa = mais determinística. |
| `defaultMethod` | `string` | `"llm"` | Método de tradução padrão: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api`. `local` é um servidor compatível com OpenAI na sua máquina (Ollama por padrão). Substituído pela flag de CLI `--method`. |
| `batchSize` | `number` | `80` | Chaves por lote de tradução. Maior = menos chamadas de API, mas prompts maiores. |
| `coachingFile` | `string` | `null` | Caminho para um arquivo de prompt de coaching em texto livre (relativo à raiz do projeto). O conteúdo é lido na inicialização e injetado no prompt de sistema como um bloco `Coaching guidance:`. |
| `promptContext` | `string` | `null` | String de contexto da aplicação injetada no prompt de sistema (por exemplo, "Descrições de produtos de e-commerce"). Ajuda o modelo a adequar as traduções ao seu domínio. |
| `genderGuidance` | `string` \| `false` | `null` | Como os prompts de LLM tratam o gênero gramatical. `null` mantém o padrão de cada idioma do catálogo do Champollion — para o francês, *écriture inclusive* com o ponto médio (`Connecté·e`, `Utilisateur·rice·s`); para o alemão, a forma com dois-pontos (`Benutzer:innen`). `false` não envia instrução de gênero; uma string envia a sua própria (por exemplo, `"Use the masculine generic."`). Também configurável por idioma e por par. Veja [Orientação de gênero](#gender-guidance). |
| `protectedTerms` | `string[]` | `[]` | Nomes para manter exatamente como escritos em todos os idiomas: pessoas, empresas, produtos (por exemplo, `["Curtis Forbes", "Game Day Suits"]`). O modelo é instruído a mantê-los, e um valor composto apenas por esses nomes nunca é sinalizado como não traduzido ou em escrita incorreta. Isso é diferente de `noTranslate`, que ignora **chaves** inteiras. |
| `jsonConcurrency` | `number` | `200` | Máximo de traduções paralelas de locales para sincronização de chaves JSON. Substituído pela flag de CLI `--json-concurrency`. |
| `contentConcurrency` | `number` | `48` | Máximo de chamadas de API paralelas para tradução de conteúdo (Markdown/MDX). Substituído pela flag de CLI `--content-concurrency`. |
| `fallbackPrefix` | `string` | `"[EN] "` | Prefixo marcador usado por `audit` e `verify` para detectar valores legados não traduzidos de execuções anteriores. O Champollion não escreve este prefixo — ele apenas o lê para detecção. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Nome da variável de ambiente para a chave de API. Sobrescreva para nomes personalizados de variáveis de ambiente. |
| `minContentRetention` | `number` | `0.35` | Fração de letras/dígitos da origem que uma saída deve reter antes que a [verificação de exclusão de conteúdo](/docs/concepts/quality-gate) consulte seu segundo sinal. Também configurável por par e por idioma. |
| `noTranslate` | `string[]` | `[]` | Chaves em dot-path e padrões glob cujo valor é copiado para cada locale literalmente. Veja [Chaves não traduzíveis](#no-translate). Também aceito como `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | Trata valores de origem que são apenas uma URL `scheme://` como não traduzíveis. Defina `false` para enviar chaves com valor de URL para o backend de tradução. |
| `baseUrl` | `string` | `""` | URL base para geração de artefatos de SEO (hreflang, sitemaps, JSON-LD). |
| `pairs` | `object` | `{}` | Substituições de método, modelo e qualidade por par. Veja [Configuração de pares](#pair-configuration). |
| `languages` | `object` | `{}` | Substituições por idioma. Veja [Configuração de idiomas](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Diretório de origem para verificação de lint. `null` = detecção automática a partir do framework. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Padrões glob a serem excluídos do lint. |
| `lint.minLength` | `number` | `2` | Tamanho mínimo da string para sinalizar como hardcoded. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | Template de padrão de URL para geração de tags hreflang. |
| `seo.pages` | `string[]` | `null` | Lista explícita de páginas para SEO. `null` = detecção automática a partir das chaves de locale. |
| `typegen.output` | `string` | `null` | Caminho de saída para os tipos TypeScript gerados. `null` = desativado. |
| `typegen.autoGenerate` | `boolean` | `false` | Regenerar tipos automaticamente após cada sincronização. |

## Estruturas de arquivos de locale {#locale-layouts}

O Champollion lê seus arquivos de locale onde seu framework já os armazena. Existem três formatos.

**Um arquivo por idioma** (`flat`). next-intl, vue-i18n, Hugo e a maioria das configurações personalizadas:

```text
messages/
  en.json      ← source
  fr.json
  de.json
```

```json title="champollion.config.json"
{ "localesDir": "./messages" }
```

**Uma pasta por idioma** (`dir`). i18next e react-i18next, onde cada arquivo é um *namespace*:

```text
public/locales/
  en/
    common.json      ← source namespaces
    admin/users.json
  fr/
    common.json
    admin/users.json
```

```json title="champollion.config.json"
{ "localesDir": "./public/locales" }
```

O Champollion escolhe `dir` quando `<localesDir>/<inputLocale>/` for uma pasta de arquivos de locale. Cada arquivo de origem é sincronizado para o mesmo caminho na pasta de cada idioma, e pastas e arquivos ausentes são criados. Um namespace pode ser um caminho aninhado (`admin/users`).

**Qualquer outro formato** (`localesPattern`). Indique o caminho com `{lang}` e, se um idioma tiver vários arquivos, `{ns}`:

```json title="champollion.config.json"
{ "localesPattern": "src/translations/{ns}/{lang}.json" }
```

`{lang}` pode se repetir, como em `"{lang}/app_{lang}.json"`. `{ns}` pode aparecer uma vez e pode abranger pastas. O formato vem da extensão, a menos que `format` esteja definido.

O `champollion init` encontra essas estruturas para você. Primeiro, ele verifica se há um aplicativo Flutter (`pubspec.yaml`, com `l10n.yaml` se presente) e catálogos gettext (`locale/<lang>/LC_MESSAGES/`, `translations/`, GNU `po/`) e grava um `localesPattern` para eles. Em seguida, ele verifica a pasta comum do seu framework (`messages/` para next-intl, `public/locales/` e depois `locales/` para i18next, `src/locales/` para vue-i18n, `i18n/` para Hugo), depois `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` e `src/i18n`. Ele usa apenas pastas que contenham o arquivo do seu idioma de origem e exibe o que encontrou. O `init --langs fr,de` também cria os arquivos de destino vazios nessa estrutura.

:::note[Como um idioma com múltiplos arquivos é sincronizado]
Cada arquivo é comparado, traduzido e gravado individualmente. O `.champollion.lock` registra as chaves como `<namespace>::<key>` (`common::nav.home`), assim como `--force-keys`, IDs de unidade do `xliff` e `sync --dry --json`. Uma chave simples em `--force-keys` corresponde a essa chave em todos os arquivos. Projetos com um arquivo por idioma mantêm chaves simples, portanto, seu arquivo de lock não muda.

A Memória de Tradução é indexada pelo texto de origem, não por arquivo. Uma string que aparece em dois namespaces é traduzida uma vez por idioma. O segundo arquivo a obtém do cache sem custo.
:::

Se ambos `en.json` e uma pasta `en/` preenchida existirem, o Champollion é interrompido e pede que você defina `"localesLayout": "flat"` ou `"dir"` em vez de tentar adivinhar.

### Chaves de plural do i18next {#i18next-plurals}

O i18next armazena plurais como chaves irmãs com um sufixo CLDR: `item_one`, `item_other`. Os idiomas possuem diferentes formas plurais. O francês e o espanhol também usam `_many`, o árabe usa seis formas e o japonês apenas `_other`. Quando um arquivo JSON de origem contém essas chaves, cada destino recebe exatamente as formas do seu próprio idioma, lidas do CLDR por meio da API JavaScript `Intl.PluralRules`:

```json title="en.json"
{ "item_one": "{{count}} item", "item_other": "{{count}} items" }
```

Após uma sincronização, `fr.json` tem `item_one`, `item_many` e `item_other`, e `ja.json` tem apenas `item_other`. A sincronização informa, para seus próprios idiomas, quais formas cada um ganha ou perde.

Novas formas são traduzidas a partir do texto `_other` da origem, `_one` a partir de `_one`. Um `_zero` na origem é mantido em todos os idiomas, pois o i18next o consulta para uma contagem de 0 em todos os idiomas. Se uma sincronização anterior tiver gravado uma forma que o idioma não usa, como `item_one` em japonês, a sincronização a remove apenas quando a Memória de Tradução indicar que a sincronização produziu esse valor. Um valor escrito manualmente é mantido. Uma chave para uma forma que o idioma não possui e para a qual a origem também não tem chave (`item_two` em espanhol) nunca é removida por conta própria: `verify` a indica, e `sync --prune plural-extras` remove exatamente essas chaves, listando cada uma (com `--dry`, informa o que removeria). Para um idioma para o qual o CLDR não tem regras de plural, as formas da origem são copiadas uma a uma, e a sincronização informa isso.

### Mensagens ICU {#icu}

Valores escritos em ICU MessageFormat (next-intl, react-intl, vue-i18n, Flutter) misturam código com texto:

```json
{ "items": "{count, plural, =0 {No events} one {# event} other {# events}}" }
```

Apenas o texto dentro dos ramos é traduzido. O [quality gate](/docs/concepts/quality-gate) rejeita uma tradução que altere qualquer outra coisa:

- nomes de variáveis (`count`, `{name}`), que nunca são renomeados ou removidos;
- as palavras `plural`, `select` e `selectordinal`, e o tipo de `{price, number}`;
- seletores (`=0`, `one`, `other`, `male`). Um `select` mantém exatamente suas opções. Um `plural` mantém os seletores da origem e pode adicionar as categorias que o idioma de destino usa, a partir do CLDR: o francês adiciona `many`, o polonês `few` e `many`. Uma categoria que o idioma não usa pode ser descartada, como o japonês que mantém apenas `other`;
- `#` em cada ramo de plural que o contenha, exceto `zero`, `one`, `two` e `=N`, onde um idioma pode escrever o número por extenso;
- `offset:N`, argumentos aninhados e conversões printf como `%s`, `%d` e `%(name)s`.

O modelo é informado sobre quais categorias o idioma de destino utiliza. Uma tradução rejeitada é tentada novamente uma vez com o motivo, por exemplo `ICU keyword 'other' was translated to 'óthér'`. Um apóstrofo antes de um placeholder (`d'{name}`) é permitido. `verify` e `integrity` executam a mesma verificação em arquivos já gravados. Um `sync` comum mantém um valor já existente em disco, portanto cada ocorrência indica o comando que a repara, `champollion sync --pair <pair> --redo keys:<key>`. Quando o valor corrompido vier da Memória de Tradução, eles o removem do cache, de modo que esse comando traduza a chave novamente em vez de fornecer o mesmo texto; nenhum `--fresh` é necessário.

### Catálogos gettext (.po) {#gettext}

Aponte `localesPattern` (ou `localesDir`) para seus catálogos:

```json title="Django"
{ "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po" }
```

```json title="GNU (po/fr.po, po/de.po, po/hello.pot)"
{ "localesDir": "./po", "format": "po" }
```

**A origem** é o catálogo do idioma de origem, por exemplo `locale/en/LC_MESSAGES/django.po` a partir de `django-admin makemessages -l en`. Seu `msgid` é o texto a ser traduzido quando `msgstr` estiver vazio. Quando esse catálogo não existir, a origem será um template `.pot`:

- Com `localesDir`: o único `.pot` nessa pasta.
- Com `localesPattern`: `<name>.pot` na pasta anterior ao primeiro placeholder ou na pasta acima dela. `<name>` é o namespace (`{ns}`, um template por domínio como `django.pot`), ou o nome de arquivo do padrão sem `{lang}` (`messages.po` → `messages.pot`).
- Com `localesLayout: "dir"`: nenhum template é procurado. Mantenha o catálogo de origem em `<localesDir>/<source>/`.

Dois templates onde apenas um é esperado interrompem a execução. O Champollion não tenta adivinhar qual deles é a origem.

**Chaves.** Cada `msgid` é uma chave. Uma entrada com um `msgctxt` tem a chave `msgctxt` + U+0004 + `msgid`, a codificação do próprio gettext. "Open" o verbo e "Open" o adjetivo são chaves separadas e entradas separadas no cache. Os relatórios exibem o separador como `␄` (`verb␄Open`), e `--force-keys "verb␄Open"` o aceita. Se você não conseguir digitar `␄`, escreva `\x04` (`--force-keys 'verb\x04Open'`): ambas as grafias funcionam. `--force-keys` (e `--redo keys:`) divide por vírgulas; escreva uma vírgula dentro de um msgid como `\,` e coloque o argumento entre aspas: `--redo 'keys:Welcome back\, %(name)s!'`. Entradas inalteradas vêm do cache sem custo.

**O que é traduzido.** Uma entrada com um `msgstr` vazio, ou sinalizada com `fuzzy`, não está traduzida. O sync a traduz e remove `fuzzy` junto com as linhas de previous-msgid `#|`. Comentários de tradutores (`# …`) são mantidos. Referências (`#:`), comentários extraídos (`#.`) e flags vêm da origem. Comentários `#.` e `msgctxt` são enviados ao modelo como contexto. Entradas que o sync não alterou são regravadas byte a byte. Entradas que a origem não tem mais e entradas `#~` obsoletas são mantidas no final.

Um catálogo criado pelo Champollion (`init --langs`, ou sync para um locale que ainda não tem catálogo) recebe o cabeçalho completo que o `msginit --no-translator` grava e que o `msgfmt -c` aceita: `Project-Id-Version`, `Report-Msgid-Bugs-To` e `POT-Creation-Date` copiados do template (`PACKAGE VERSION` é substituído pelo nome da pasta do projeto, e não há `POT-Creation-Date` sem uma data no template), `PO-Revision-Date` (quando o arquivo foi criado), `Last-Translator: Automatically generated`, `Language-Team: none`, `Language`, `MIME-Version: 1.0`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: 8bit` e `Plural-Forms`. O cabeçalho de um catálogo existente nunca é reescrito — apenas um placeholder `Plural-Forms` ou `charset=CHARSET` contido nele é preenchido.

**Plurais.** Uma entrada com `msgid_plural` é traduzida como uma única mensagem de plural ICU (`{n, plural, one {One file} other {%(count)d files}}`), de modo que o modelo grava todas as formas de uma vez. Ela é então gravada em `msgstr[0]`…`msgstr[n]` por meio do cabeçalho `Plural-Forms` do destino. Cada índice assume a categoria CLDR dos números que o selecionam. O `nplurals=3` russo é `one`, `few`, `many`. Se o destino não tiver um cabeçalho `Plural-Forms`, ou contiver apenas o placeholder do template, ele recebe o cabeçalho que o `msginit` grava para seu idioma, para que os slots `msgstr[]` do catálogo sejam aqueles selecionados por gettext e Django: francês `nplurals=2; plural=(n > 1);`, alemão `nplurals=2; plural=(n != 1);`, russo `nplurals=3; …`. Um idioma para o qual o `msginit` não tem entrada recebe um cabeçalho derivado do CLDR, verificado em relação a `Intl.PluralRules` para todos os números até 3.000 e para números grandes. Se as regras de um idioma não puderem ser escritas como uma expressão gettext, o sync é interrompido e indica o comando que grava o cabeçalho: `msginit --locale=<lang> --input=<template>.pot`. Uma forma para a qual o catálogo não tem slot (`many` em francês, para 1 000 000, em um catálogo de duas formas) não é solicitada novamente, marcada ou relatada como ausente; um catálogo que possui seu próprio cabeçalho o mantém, e seus slots são os que são verificados.

**Limites.** Os catálogos devem estar em UTF-8. Converta outros com `msgconv --to-code=UTF-8`. Um msgid de plural cujas chaves não estejam balanceadas não pode ser escrito como uma mensagem ICU, portanto ele é relatado e deixado para você traduzir. Ainda assim, execute `msgfmt --check-format` (Django: `compilemessages`) antes de enviar para produção. Ele verifica apenas as entradas sinalizadas com `#, python-format` (ou `c-format`, …): `makemessages` adiciona a flag às entradas que extrai com um placeholder `%`, mas um catálogo criado manualmente pode não tê-la, e essas entradas passam sem verificação. O `champollion verify` compara os placeholders de printf de cada entrada — nome e letra de tipo — quaisquer que sejam suas flags, e o sync mantém as flags da entrada de origem em cada entrada que traduz.

### Arquivos ARB do Flutter (.arb) {#arb}

```json title="champollion.config.json"
{ "localesPattern": "lib/l10n/app_{lang}.arb" }
```

Use o `arb-dir` e `template-arb-file` do seu `l10n.yaml` caso difiram (`assets/i18n/intl_{lang}.arb`). Apenas mensagens são traduzidas. Na gravação:

- `@@locale` é definido para o destino no formato do Flutter, correspondendo ao nome do arquivo (`app_pt_BR.arb` → `"pt_BR"`). `gen-l10n` recusa um arquivo cujo `@@locale` divirja do seu nome.
- Cada objeto de metadados `@key` (placeholders, seus tipos, descrições) é copiado da origem. Uma chave para a qual a origem não tenha metadados mantém os do destino.
- As chaves seguem a ordem da origem. Mensagens não traduzidas são omitidas, para que o Flutter use o template como fallback.

`description`s de mensagem são enviadas ao modelo como contexto. Placeholders `{name}` e plurais ICU são protegidos pela [verificação ICU](#icu). `verify` e `integrity` também relatam um `@@locale` incorreto e metadados de placeholder que diferem da origem. Qualquer sincronização que reescreva o arquivo repara ambos: `champollion sync --pair en:fr --force` fornece todas as mensagens inalteradas a partir do cache.

## Chaves não traduzíveis {#no-translate}

Alguns valores têm exatamente uma representação correta em todos os idiomas: uma URL, um caminho de repositório, o nome de um pacote, um identificador de produto. Uma tradução correta de `https://example.org/paper` é `https://example.org/paper`.

O [quality gate](/docs/concepts/quality-gate) do Champollion rejeita o source-echo — uma tradução idêntica à sua origem — porque isso normalmente significa que o modelo se recusou a fazer o trabalho. Para essas chaves, isso faz com que a resposta correta seja a rejeitada, e não há saída que o modelo possa produzir que seja aprovada. Modelos mais fracos aprendem a burlar o gate alterando o valor apenas o suficiente (um `#fragment` fabricado, uma barra final perdida, um espaço invisível de largura zero), o que faz com que links quebrados sejam enviados para produção. Modelos mais fortes retornam o valor inalterado e falham no gate, fazendo com que o `sync` finalize com código diferente de zero em todas as execuções.

Em vez disso, declare essas chaves:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Uma chave correspondente é **copiada do locale de origem literalmente** — nunca enviada a um backend de tradução, nunca submetida ao quality gate, nunca contabilizada como falha e nunca faturada. Ela é excluída da estimativa de custo pré-execução pelo mesmo motivo.

### Sintaxe de padrões

Os padrões são caminhos de pontos (dot-paths) sobre o espaço nivelado de chaves, com dois caracteres curinga:

| Padrão | Corresponde a | Não corresponde a |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (caminho exato) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (uma folha `url` em qualquer profundidade) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` corresponde a um único segmento; `**` corresponde a zero ou mais segmentos inteiros.
Um padrão sem caracteres curinga é um caminho de chave exato.

### URLs são tratadas por padrão

Como uma chave cujo valor é uma URL não tem um resultado correto sob o gate, `noTranslateUrls` é `true` por padrão: qualquer valor de origem que consista apenas em uma URL `scheme://` absoluta é tratado como não traduzível sem necessidade de configuração.

A detecção é deliberadamente restrita — todo o valor (sem espaços nas extremidades) deve ser a URL. Textos que apenas contenham um link (`"Read the paper at https://…"`) ainda são traduzidos normalmente.

Desative isso com `"noTranslateUrls": false` se suas URLs forem realmente específicas por locale (hosts de documentação por idioma, por exemplo) — e então declare as que não são com `noTranslate`.

### Reparo e aplicação de regras

Para uma chave não traduzível, existe exatamente um valor de destino correto; portanto, qualquer diferença é um defeito. O Champollion impõe isso em ambas as direções:

- **`sync` o repara.** Uma chave não traduzível cujo destino esteja ausente, com prefixo `[EN] ` ou alterado é regravada a partir da origem. Isso não consome chamadas de API e é idempotente: assim que os valores coincidirem, sincronizações posteriores ignoram a chave completamente.
- **`verify` e `integrity` falham com ele.** Uma chave não traduzível que divergiu é relatada como `NO-TRANSLATE DRIFT` com os valores esperado e real — caracteres invisíveis escapados como `\uXXXX`, já que essa classe de corrupção seria impossível de enxergar em um diff. O `champollion integrity` sai com `1`, de modo que uma build vinculada a ele detecta uma URL corrompida antes que ela vá para produção.

Se o `integrity` falhar dessa forma em um projeto recém-configurado, ele estará relatando danos que já existiam nos seus arquivos de locale. Execute `champollion sync` uma vez para repará-los.

## Conversão de escrita {#script-conversion}

Alguns idiomas que o Champollion traduz podem ser *escritos* de mais de uma maneira. O modelo sempre opera no **sistema de escrita de trabalho** do idioma (romanização em alfabeto latino — SRO para Plains Cree, romanização de Okrand para Klingon), e um conversor determinístico pode então reescrever a saída em um sistema de escrita de exibição. Se isso deve ser feito ou não é uma decisão da configuração — **nunca um padrão**:

| Locale | Escrita de trabalho | Conversível para | Tipo |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (Silábico) | Unicode real — **escolha obrigatória** |
| `sr` / `srp` (Sérvio) | `Latn` | `Cyrl` (Cirílico) | Unicode real — **escolha obrigatória** |
| `tlh` (Klingon) | `Latn` (romanização) | `Piqd` (pIqaD) | PUA — adesão opcional (opt-in) |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — adesão opcional (opt-in) |
| `x-kryptonian` | `Latn` | Kryptoniano | PUA — opt-in via `"script": "x-kryptonian"` |

**Pares em Unicode real (crk, sr) exigem a escolha.** O silábico Cree e o cirílico são Unicode comum — renderizam em qualquer lugar — e ambas as ortografias estão em uso real. O Champollion não escolherá o sistema de escrita de uma comunidade em nome de um projeto: o `init` pergunta quando você seleciona o idioma, e o `sync` se recusa a rodar até que a configuração informe qual:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**Sistemas de escrita PUA (tlh, x-elvish-s, x-kryptonian) usam a romanização por padrão.** pIqaD, Tengwar e Kryptoniano *não estão no Unicode* — os conversores emitem code points de Área de Uso Privado (PUA) que não renderizam nada a menos que você forneça uma fonte mapeada para esses code points. A romanização é a única saída que renderiza em qualquer lugar, portanto é o padrão. Para emitir a escrita de exibição em vez disso:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…e execute `champollion fonts install` para que seu site tenha uma fonte capaz de desenhá-la. Se suas fontes forem mapeadas para transliteração latina (como muitas fontes de conlang são), mantenha o padrão.

`script` aceita um código ISO 15924, sem diferenciar maiúsculas/minúsculas (`"cans"`, `"Cans"` e `"CANS"` são iguais). Também pode ser definido por par, o que tem precedência sobre o nível de idioma. Um valor inválido, ou uma escrita que o locale não puder produzir, falha na inicialização — antes de qualquer chamada de API.

### Letras não mapeadas e `scriptFallback` {#script-fallback}

Os conversores traduzem o que sua ortografia define e nada mais. A romanização do Klingon não tem `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` ou `z` — portanto a saída do modelo contendo um nome próprio como "GitHub" não pode ser totalmente convertida. O Champollion **nunca grava um valor parcialmente convertido**: se qualquer letra não puder ser mapeada, o valor inteiro permanece no sistema de escrita de trabalho, e o aviso indica as letras além da linha de configuração que as mapearia.

Esses mapeamentos cabem a você declarar:

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

Cada regra substitui uma sequência da escrita de trabalho por uma que o conversor *pode* mapear, antes da execução da conversão. As regras são validadas na inicialização — uma substituição que em si seja não mapeável é rejeitada.

O Champollion não inclui **nenhuma regra de fallback própria**: inventar adaptações ortográficas, especialmente para o sistema de escrita de um idioma real, não cabe a uma ferramenta de indexação decidir. Comunidades e fandoms têm convenções — adote-as deliberadamente, por projeto.

### Reparando conversões indesejadas {#repair-script}

Antes da versão 0.3.0, a conversão era incondicional — projetos direcionados a locales PUA recebiam saídas não renderizáveis quer quisessem ou não. Duas ferramentas resolvem isso:

- O **`champollion repair-script`** examina locales cuja configuração diz que a conversão está *desativada* em busca de code points PUA e restaura a romanização usando a própria tabela inversa do conversor (`--dry` para pré-visualizar). O pIqaD reverte com exatidão; as reversões de Tengwar e Kryptoniano perdem a distinção de maiúsculas/minúsculas e informam isso.
- O **`champollion integrity`** falha (código de saída 1) ao encontrar PUA onde a conversão está desativada — para que um gate de build detecte texto não renderizável antes do deploy, e o relatório indica o comando de reparo.

A Memória de Tradução nunca precisa de reparo: ela armazena valores pré-conversão, portanto ativar ou desativar o `script:` posteriormente não requer nenhuma alteração no cache.

A conversão de escrita se aplica a strings de interface de usuário (arquivos chave-valor e JSON do Docusaurus). Corpos de Markdown nunca são convertidos — um conversor de caracteres guloso não tem como passar com segurança por blocos de código inline, URLs e frontmatter.

## Configuração de Par {#pair-configuration}

Cada par origem→destino pode ser configurado independentemente:

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-3.1-pro-preview"
    },
    "en:crk": {
      "method": "llm-coached"
    }
  }
}
```

### Campos de Par

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `method` | `string` | Método de tradução: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api` |
| `methodPlugin` | `string` | Nome de um plugin instalado (de `.champollion/methods/`) |
| `model` | `string` | Substitui o modelo padrão para este par |
| `temperature` | `number` | Substitui a temperatura padrão para este par |
| `batchSize` | `number` | Substitui o tamanho de lote padrão para este par |
| `register` | `string` | Substituição de registro/tom (chave predefinida ou texto livre) |
| `endpoint` | `string` | URL do endpoint de API remota. Obrigatório quando `method` for `api`. |
| `coachingFile` | `string` | Caminho para um arquivo de prompt de coaching para este par, lido relativamente ao projeto; substitui qualquer coaching menos específico, e um arquivo que não puder ser lido interrompe a execução |
| `promptContext` | `string` | Contexto da aplicação para este par |
| `genderGuidance` | `string` \| `false` | Instrução de gênero para os prompts deste par: seu próprio texto, ou `false` para nenhuma. Veja [Orientação de gênero](#gender-guidance). |
| `qualityTier` | `string` | Um rótulo atribuído à saída do par: `standard`, `high`, `research`, `verified`. Não é medido, e o sync traduz da mesma forma independentemente do que estiver escrito; o `status` o exibe (apenas quando definido) e o `serve` o divulga |
| `fallback` | `object` | Um segundo método para o que o método deste par não puder traduzir com segurança. Veja [Método de fallback](#fallback). `null` remove um fallback definido no idioma. |

### Método de fallback {#fallback}

Um par pode indicar um segundo método. O próprio método do par traduz primeiro. O que ele não puder traduzir com segurança vai para o fallback uma vez:

- **Arquivos chave-valor:** chaves que o [quality gate](/docs/concepts/quality-gate) recusou (um `{name}` omitido, um plural quebrado, um rótulo de duas palavras transformado em parágrafo) e chaves para as quais o método não retornou nada.
- **Markdown (conteúdo do Hugo e docs do Docusaurus):** campos de frontmatter que ele omitiu ou esvaziou de suas palavras, e blocos de corpo omitidos de sua resposta, danificados (perderam um elemento protegido: código, uma tag HTML, um shortcode) ou esvaziados. Na segmentação `page`, a página inteira.

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
    }
  }
}
```

Quando nenhum texto puder sair das suas máquinas (um hospital, uma escola, uma comunidade que mantém seus dados linguísticos no local), configure o fallback como um modelo que você mesmo executa. O método `local` envia para um servidor compatível com OpenAI nesta máquina (Ollama, llama.cpp, vLLM, LM Studio; `LOCAL_API_BASE` define o endereço, veja [`local`](/docs/guides/translation-methods#local--your-own-model-ollama-vllm-lm-studio-a-trained-model)):

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "local", "model": "<your local model>" }
    }
  }
}
```

Qual utilizar:

- **Um modelo hospedado** (`llm-coached` com um modelo Gemini, ou outro método de API) geralmente é a segunda opinião mais forte para um idioma com poucos recursos computacionais e é cobrado por requisição. Use-o quando o texto puder ser enviado a esse provedor.
- **`local`** mantém todas as chaves nesta máquina, e a estimativa o exibe como `$0 API cost (runs on this machine)`. Use-o quando nada puder sair da máquina, mesmo que o modelo executado localmente seja menor.

A saída do fallback passa pelo mesmo quality gate. O que ele traduz é armazenado em cache sob seu próprio método na Memória de Tradução, de forma que o cache registra qual método produziu cada valor. Sincronizações posteriores o reutilizam em vez de consultar o primeiro método novamente; `--fresh` ou `--retranslate` consulta novamente. O que nenhum dos dois métodos traduzir permanece como ficaria sem um fallback. Uma chave é deixada sem tradução e mantém sua entrada de lock anterior, para que o próximo sync tente traduzi-la novamente e o `champollion verify` a liste. Um bloco de Markdown é gravado como origem com prefixo `[EN] `, não entra em cache, e o arquivo é processado novamente na próxima sincronização. Um bloco ou campo de frontmatter recusado pelo quality gate em ambos os métodos é retido, não sendo enviado a eles novamente até que `--redo files:<page>` mencione a página ([Blocos de Markdown e campos de frontmatter recusados](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). Um campo de frontmatter esvaziado por ambos os métodos, ou uma página que nenhum dos dois traduz, causa falha no arquivo, assim como ocorreria sem um fallback.

Um fallback aceita os mesmos campos que um par: `method` (obrigatório), `model`, `provider`, `endpoint`, `methodPlugin`, `coachingFile`, `coachingPrompt`, `promptContext`, `register`, `temperature`, `batchSize`, `maxRetries`, `qualityTier`, `contentSegmentation`, `name`. Ele é resolvido da mesma forma que um par. Campos que ele não define (registro, coaching, contexto de prompt, …) vêm de seu par. Seu próprio `coachingFile` chega ao seu prompt e à sua chave de cache, e `champollion status` o exibe. O sistema de escrita pertence ao par, portanto `script` e `scriptFallback` são recusados em um fallback, assim como o próprio `fallback` de um fallback. Um método desconhecido, ou um fallback idêntico ao seu par, interrompe a sincronização com um erro que indica o par. O fallback deve estar pronto para execução antes do início da sincronização, assim como o método do próprio par (por exemplo, sua chave de API deve estar definida).

- **`--method` e `--model` alteram apenas o método do próprio par.** O fallback mantém o que o arquivo de configuração define.
- **Custo.** A estimativa pré-execução cobre apenas o método do próprio par: ninguém sabe com antecedência o que ele falhará. Cada lote de fallback tem seu preço calculado logo antes de ser executado, com o mesmo estimador. Com `--max-cost`, um lote que ultrapassaria o limite da execução (a estimativa mais cada lote de fallback até o momento) é ignorado, com um aviso indicando as chaves. O mesmo se aplica a um fallback cujo custo não possa ser estimado (desconhecido não significa gratuito). Essas chaves permanecem como falha, e o sync sai com código diferente de zero, como em qualquer falha parcial.
- **Relatórios.** O `sync` exibe uma linha por par, por exemplo `[FALLBACK] en:crk — 6 key(s) the primary (api) could not translate safely → translated by llm-coached (4 accepted, 2 still failing)`. O resumo de `--json` informa por par o que o fallback fez (`method`, `attempted`, `accepted`, `failed`, `cached`): em cada entrada de `locales` para arquivos chave-valor, em `fallback` para JSON do Docusaurus e em `content.fallback` para Markdown. O `champollion status` mostra o fallback sob o seu par. O `--dry` não tem como saber o que falhará, portanto não relata nada sobre o fallback.
- **Quando o fallback escreveu a maior parte.** Quando mais da metade das novas traduções de uma execução para um par (as respostas aceitas do método do par mais as do fallback) vieram do fallback, o `sync` adiciona um aviso: quantas de quantas, por qual método e modelo, por que as respostas do método do par não foram usadas (cada motivo contabilizado: uma frase decorada repetida para diferentes strings de origem, inflação de comprimento, …) e o que considerar — o método do par pode não ser adequado para essas strings; verifique o que foi gravado (`verify` verifica a estrutura, um falante do idioma verifica o significado); um fallback mais forte. As entradas de `--json` trazem `primaryAccepted` e `primaryReasons` ao lado de `accepted`. O `champollion status` fornece a mesma proporção para os arquivos ("from the fallback: 8 value(s) in the files (…) — 8 of the 8 sync wrote (100%)"), e avisa quando representa a maior parte do texto do locale.
- O `champollion serve` também usa o fallback, dentro de seus limites de `--max-cost-per-request` / `--max-session-cost`.

## Configuração de Idioma {#language-configuration}

Idiomas aceitam três formatos:

### Array de códigos (mais simples)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

Cada idioma obtém seu registro padrão da tabela de registro integrada. Idiomas sem padrão recebem `"Professional register."`.

### Objeto com strings de registro

O valor pode ser uma **chave predefinida** do cartão do idioma, ou texto de registro personalizado:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion verifica se a string corresponde a uma chave predefinida no cartão do idioma. Se corresponder, o prompt de registro completo do cartão é usado. Se não, a string é usada como está. Veja [Idiomas Suportados](/docs/reference/supported-languages#language-cards) para predefinições disponíveis.

### Objeto com configuração completa

```json
{
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-3.1-pro-preview",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

Você pode misturar objetos abreviados e completos no mesmo bloco.


### Campos de Idioma

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `register` | `string` | Instruções de estilo/tom. Pode ser uma **chave predefinida** (por exemplo, `casual-tu`, `formal-hapsyo`) ou texto personalizado. Veja [Cartões de idiomas](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Nome legível do idioma (para exibição de status) |
| `model` | `string` | Substitui o modelo padrão |
| `temperature` | `number` | Substitui a temperatura padrão |
| `batchSize` | `number` | Substitui o tamanho de lote padrão |
| `coachingFile` | `string` | Caminho para um arquivo de prompt de coaching para este idioma, lido relativamente ao projeto; substitui o coaching de nível superior, e um arquivo que não puder ser lido interrompe a execução |
| `promptContext` | `string` | Contexto da aplicação para este idioma |
| `genderGuidance` | `string` \| `false` | Instrução de gênero para os prompts deste idioma: seu próprio texto, ou `false` para nenhuma. Veja [Orientação de gênero](#gender-guidance). |
| `maxRetries` | `number` | Limite máximo de tentativas para lotes com falha (padrão: 3) |
| `script` | `string` | Código ISO 15924 da ortografia que o Champollion grava (por exemplo, `"Cans"`, `"Piqd"`). Veja [Conversão de escrita](#script-conversion). |
| `scriptFallback` | `object` | Regras de transliteração para letras que o conversor de escrita não consegue mapear. Veja [Conversão de escrita](#script-conversion). |
| `endpoint` | `string` | URL do endpoint de API remota, para `"method": "api"` |
| `fallback` | `object` | Um segundo método para o que o método deste idioma não puder traduzir com segurança. Veja [Método de fallback](#fallback). |

:::info[Cadeia de herança]
As configurações são resolvidas nesta ordem (a primeira vence):

**nível de par** → **nível de idioma** → **configuração global** → **padrões**

Por exemplo, se `pairs["en:fr"]` define `model`, ele sobrescreve tanto o nível de idioma quanto os valores globais de `model`.
:::

### Orientação de gênero {#gender-guidance}

Prompts de LLM contêm uma instrução sobre gênero gramatical para idiomas que o possuem. Isso vem do catálogo do Champollion: o francês requer *écriture inclusive* com o ponto médio quando o gênero do leitor for desconhecido (`Connecté·e`, não `Connecté(e)` ou `Connectée`; `Utilisateur·rice·s` no plural), o alemão a forma com dois-pontos (`Benutzer:innen`), o japonês o `私` neutro. O `champollion init` o exibe ao lado do registro de cada idioma, e o `champollion status` o mostra por par, acompanhado de sua origem.

Escolha outro estilo com `genderGuidance`, para todos os idiomas ou para um só:

```json
{
  "languages": {
    "fr": { "register": "formal-vous", "genderGuidance": "Use the masculine generic (Connecté), as the Académie française recommends." },
    "de": { "register": "formal-Sie", "genderGuidance": false }
  }
}
```

`false` não envia nenhuma instrução de gênero; uma string substitui a do catálogo. A configuração se aplica a métodos que aceitam instruções (os métodos de LLM); mecanismos de tradução automática tradicional (DeepL, Google, …) não recebem essa instrução. Uma instrução de gênero alterada representa um prompt diferente, portanto possui suas próprias entradas no cache: o que já foi traduzido permanece como está até você traduzir novamente (`champollion sync --redo all`, sugerido pelo sync quando os arquivos contiverem o estilo anterior).

## Origem Não-Inglesa

Se seu idioma de origem não for inglês:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## Arquivo de Bloqueio

O Champollion cria o `.champollion.lock` para rastrear os hashes SHA-256 dos valores de origem traduzidos. **Faça o commit deste arquivo** para que todos os desenvolvedores compartilhem a mesma linha de base de tradução. Em um projeto com uma pasta por idioma, as chaves são registradas como `<namespace>::<key>`.

Por locale de destino, o lock também registra uma impressão digital (fingerprint) de cada valor gravado pelo sync e do texto de origem traduzido (para que uma edição manual feita por uma pessoa seja reconhecida e uma tradução desatualizada seja relatada), as chaves que uma repetição (redo) não conseguiu concluir (**pendentes**) e as chaves que o quality gate recusou (**retidas** para o mesmo modelo). Ao registrar qualquer um desses itens, o arquivo assume seu formato de versão 2, `{"version": 2, "source": {…}, "locales": {…}}`; um lock de versão 1 (um mapa simples de chave → hash) é lido como antes. Uma edição manual substituída é mantida em `.champollion-replaced-edits.jsonl` ao lado dele — faça o commit de ambos. Veja [Quality Gate](/docs/concepts/quality-gate#refused-keys-are-held-back) e [Editando traduções](/docs/guides/professional-translators#editing-key-value-files).

Quando um valor de origem muda, o hash não corresponde mais, e champollion retraduz essa chave na próxima sincronização.

## `.champollionignore`

Crie `.champollionignore` na raiz do seu projeto para excluir arquivos da varredura de `lint`. Usa padrões glob, como `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## Diretório `.champollion/`

O Champollion cria um diretório `.champollion/` na raiz do projeto para estado interno. Mantenha-o fora do controle de versão — é um cache local por máquina, não código-fonte do projeto. O `champollion init` adiciona esta linha ao `.gitignore`, criando o arquivo caso não exista (mesmo em uma pasta que ainda não seja um repositório git, para que `git init` e `git add --all` posteriores não façam commit do cache):

```gitignore
.champollion/
```

Faça o commit dos arquivos de lock ao lado dele (`.champollion.lock`, `.champollion-content.lock`): eles registram a partir de qual texto de origem cada tradução foi realizada.

| Arquivo | Finalidade | Fazer commit? |
|------|---------|--------|
| `tm.json` | Cache da Memória de Tradução — armazena traduções anteriores indexadas por texto de origem + locale + método | Não (cache local) |
| `xliff/*.xliff` | Arquivos de exportação XLIFF para revisão por tradutores profissionais | Não (temporário) |
| `methods/` | Manifestos de plugins de métodos instalados | Ignorado pela linha `.champollion/`. Para compartilhar plugins instalados, substitua essa linha por `.champollion/*` e `!.champollion/methods/` |
| `backups/` | Backups pré-wrap (criados por `wrap --undo`) | Não (rede de segurança) |

Veja [Memória de Tradução](/docs/concepts/translation-memory) para detalhes sobre `tm.json` e como ela economiza custos de API.

---

## API Programática

Para scripts de build e integrações personalizadas, importe diretamente do pacote:

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### Exportações Disponíveis

| Exportação | O que faz |
|--------|-------------|
| `TranslationMethod` | Classe base para todos os métodos |
| `LLMMethod` | Classe base para métodos LLM (OpenRouter) |
| `DirectLLMMethod` | Classe base para provedores diretos de LLM (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Classes de provedores diretos de LLM |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Classes de TA (tradução automática) tradicional |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | LLM com coaching (OpenRouter + dados de coaching) |
| `APIMethod` | Cliente de API remota |
| `runSync`, `runContentSync` | Pipeline completo de sincronização |
| `translateWithFallback`, `translateAndValidate` | Pipeline de um par para um lote de chaves, como `sync` o executa: cache, método, quality gate, cache e então o fallback do par. Passe um par de `resolvePairs`, `tm` de `loadTM` e `cwd`, o diretório do projeto: o método lê sua chave, endpoint, coaching e glossário lá, não de `process.cwd()` |
| `createFallbackBudget` | A proteção `--max-cost` para lotes de fallback (`{ maxCost, committed, cwd }`) |
| `discoverLocaleLayout`, `resolveLocaleFiles` | Os arquivos que compõem cada locale (plano, pasta por locale ou `localesPattern`) |
| `resolveConfig`, `resolvePairs` | Resolução de configuração |
| `validateTranslations` | Quality gate |
| `loadCoachingData`, `findDictionaryMatches` | Utilitários de coaching |

### Extensão de Provedor Personalizado

Estenda `DirectLLMMethod` para adicionar um novo provedor LLM em ~40 linhas:

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

Você obtém tradução, coaching, loops de tentativa, validação de modelo, níveis de qualidade e ajuda de configuração gratuitamente. Apenas a forma da solicitação HTTP é específica do provedor. Para adaptadores não-LLM que usam `fetch()` bruto, use o helper compartilhado `fetchWithRetry()` de `lib/methods/fetch-with-retry.js` em vez de escrever seu próprio loop de tentativa.

---

## Veja Também

- [Referência CLI](/docs/reference/cli) — todos os comandos e flags
- [Métodos de Tradução](/docs/guides/translation-methods) — escolhendo e misturando métodos
- [Memória de Tradução](/docs/concepts/translation-memory) — cache e economia de custos
- [Trabalhando com Tradutores Profissionais](/docs/guides/professional-translators) — fluxo de trabalho XLIFF
- [Especificação de Plugin](/docs/reference/plugin-spec) — formato de manifesto de plugin de método
- [Arquitetura](/docs/concepts/architecture) — como as peças se conectam
- [Idiomas Suportados](/docs/reference/supported-languages) — suporte de idioma integrado
- [Como a Sincronização Funciona](/docs/concepts/how-sync-works) — o pipeline de tradução
