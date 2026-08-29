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
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.5-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
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
| `localesDir` | `string` | `"./locales"` | Caminho para os arquivos de localidade (locale). O Champollion verifica este diretório. |
| `contentDir` | `string` | `null` | Diretório de conteúdo do Hugo. Habilita a tradução do corpo em Markdown. |
| `translatableFields` | `string[]` | `null` | Substitui os campos traduzíveis padrão do frontmatter para a tradução de conteúdo. `null` usa os padrões integrados (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Formato do arquivo: `json`, `toml`, `yaml` ou `auto` (detectado pela extensão). |
| `model` | `string` | `"google/gemini-3.5-flash"` | Modelo padrão para métodos LLM. Aceita slugs completos do OpenRouter (`provider/model`) ou aliases curtos de `shared/model-aliases.json` (ex., `gemini-flash`). Provedores diretos usam nomes simples (ex., `gpt-4o`). |
| `temperature` | `number` | `0.3` | Temperatura do LLM (0.0–2.0). Menor = mais determinístico. |
| `defaultMethod` | `string` | `"llm"` | Método de tradução padrão: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api`. Substituído pela flag de CLI `--method`. |
| `batchSize` | `number` | `80` | Chaves por lote de tradução. Maior = menos chamadas de API, mas prompts maiores. |
| `coachingFile` | `string` | `null` | Caminho para um arquivo de prompt de instrução em texto livre (relativo à raiz do projeto). O conteúdo é lido na inicialização e injetado no prompt do sistema como um bloco `Coaching guidance:`. |
| `promptContext` | `string` | `null` | String de contexto da aplicação injetada no prompt do sistema (ex., "Descrições de produtos de e-commerce"). Ajuda o modelo a adaptar as traduções ao seu domínio. |
| `jsonConcurrency` | `number` | `200` | Máximo de traduções de localidade em paralelo para sincronização de chaves JSON. Substituído pela flag de CLI `--json-concurrency`. |
| `contentConcurrency` | `number` | `48` | Máximo de chamadas de API em paralelo para tradução de conteúdo (Markdown/MDX). Substituído pela flag de CLI `--content-concurrency`. |
| `fallbackPrefix` | `string` | `"[EN] "` | Prefixo de marcador usado por `audit` e `verify` para detectar valores legados não traduzidos de execuções anteriores. O Champollion não escreve este prefixo — ele apenas o lê para detecção. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Nome da variável de ambiente para a chave de API. Substitua para nomes de variáveis de ambiente personalizados. |
| `minContentRetention` | `number` | `0.35` | Fração de letras/dígitos da origem que uma saída deve reter antes que a [verificação de exclusão de conteúdo](/docs/concepts/quality-gate) consulte seu segundo sinal. Também configurável por par e por idioma. |
| `noTranslate` | `string[]` | `[]` | Chaves em formato dot-path e padrões glob cujo valor é copiado para cada localidade de forma literal (verbatim). Consulte [Chaves Não Traduzíveis](#no-translate). Também aceito como `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | Trata valores de origem que são apenas uma URL `scheme://` como não traduzíveis. Defina como `false` para enviar chaves com valores de URL para o backend de tradução. |
| `baseUrl` | `string` | `""` | URL base para geração de artefatos de SEO (hreflang, sitemaps, JSON-LD). |
| `pairs` | `object` | `{}` | Substituições de método, modelo e qualidade por par. Consulte [Configuração de Par](#pair-configuration). |
| `languages` | `object` | `{}` | Substituições por idioma. Consulte [Configuração de Idioma](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Diretório de origem para verificação de lint. `null` = detecção automática a partir do framework. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Padrões glob a serem excluídos do lint. |
| `lint.minLength` | `number` | `2` | Comprimento mínimo da string para ser sinalizada como hardcoded. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | Modelo de padrão de URL para geração de tags hreflang. |
| `seo.pages` | `string[]` | `null` | Lista explícita de páginas para SEO. `null` = detecção automática a partir das chaves de localidade. |
| `typegen.output` | `string` | `null` | Caminho de saída para os tipos TypeScript gerados. `null` = desativado. |
| `typegen.autoGenerate` | `boolean` | `false` | Gerar tipos automaticamente após cada sincronização. |

## Chaves Não Traduzíveis {#no-translate}

Alguns valores têm exatamente uma renderização correta em todos os idiomas: uma URL, um
caminho de repositório, um nome de pacote, um identificador de produto. Uma tradução correta de
`https://example.org/paper` é `https://example.org/paper`.

O [quality gate](/docs/concepts/quality-gate) do Champollion rejeita o
eco da origem (source-echo) — uma tradução idêntica à sua origem — porque isso normalmente
é um modelo se recusando a fazer o trabalho. Para essas chaves, isso faz com que a resposta correta seja
a rejeitada, e não há saída que o modelo possa produzir que seja aprovada.
Modelos mais fracos aprendem a burlar o gate alterando o valor apenas o suficiente (um
`#fragment` fabricado, uma barra final perdida, um espaço invisível de largura zero),
o que resulta em links quebrados. Modelos mais fortes retornam o valor inalterado e falham
no gate, então `sync` sai com um código diferente de zero em cada execução.

Em vez disso, declare essas chaves:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Uma chave correspondente é **copiada da localidade de origem de forma literal (verbatim)** — nunca é enviada para um
backend de tradução, nunca passa pelo quality gate, nunca é contada como falha e nunca
é cobrada. Ela é excluída da estimativa de custo pré-execução pelo mesmo motivo.

### Sintaxe de padrões

Os padrões são caminhos com pontos (dot-paths) sobre o espaço de chaves achatado (flattened), com dois curingas:

| Padrão | Corresponde a | Não corresponde a |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (caminho exato) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (uma folha `url` em qualquer profundidade) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` corresponde dentro de um único segmento; `**` corresponde a zero ou mais segmentos inteiros.
Um padrão sem curinga é um caminho de chave exato.

### URLs são tratadas por padrão

Como uma chave com valor de URL não tem um resultado correto sob o gate,
`noTranslateUrls` é `true` por padrão: qualquer valor de origem que seja apenas
uma URL `scheme://` absoluta é tratado como não traduzível sem necessidade de configuração.

A detecção é deliberadamente restrita — todo o valor sem espaços em branco (trimmed) deve ser a URL.
Uma prosa que apenas contém um link (`"Read the paper at https://…"`) ainda é
traduzida normalmente.

Desative isso com `"noTranslateUrls": false` se suas URLs realmente forem
específicas da localidade (hosts de documentação por idioma, por exemplo) — então declare
as que não são com `noTranslate`.

### Correção e imposição

Para uma chave não traduzível, há exatamente um valor de destino correto, portanto, qualquer
diferença é um defeito. O Champollion impõe isso em ambas as direções:

- **`sync` corrige isso.** Uma chave não traduzível cujo destino está ausente,
  prefixado com `[EN] ` ou alterado é reescrita a partir da origem. Isso não custa nenhuma chamada de API,
  e é idempotente: uma vez que os valores correspondam, as sincronizações posteriores ignoram a chave
  completamente.
- **`verify` e `integrity` falham nisso.** Uma chave não traduzível que sofreu desvio (drifted) é
  relatada como `NO-TRANSLATE DRIFT` com os valores esperado e real —
  caracteres invisíveis escapados como `\uXXXX`, já que essa classe de corrupção seria
  impossível de ver em um diff. `champollion integrity` sai com `1`, para que uma
  build conectada a ele capture uma URL corrompida antes de ser enviada.

Se `integrity` falhar dessa forma em um projeto que você acabou de configurar, ele está
relatando danos que já estavam em seus arquivos de localidade. Execute `champollion sync`
uma vez para corrigi-lo.

## Conversão de Escrita {#script-conversion}

Alguns idiomas que o Champollion traduz podem ser *escritos* de mais de uma maneira. O modelo sempre trabalha na **escrita de trabalho** (working script) do idioma (romanização latina — SRO para Plains Cree, romanização de Okrand para Klingon), e um conversor determinístico pode então reescrever a saída em uma escrita de exibição (display script). Se ele deve fazer isso é uma decisão que a configuração toma — **nunca um padrão**:

| Localidade | Escrita de trabalho | Conversível para | Tipo |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (Silábico) | Unicode Real — **escolha obrigatória** |
| `sr` / `srp` (Sérvio) | `Latn` | `Cyrl` (Cirílico) | Unicode Real — **escolha obrigatória** |
| `tlh` (Klingon) | `Latn` (romanização) | `Piqd` (pIqaD) | PUA — opt-in |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — opt-in |
| `x-kryptonian` | `Latn` | Kryptoniano | PUA — opt-in via `"script": "x-kryptonian"` |

**Pares de Unicode Real (crk, sr) exigem a escolha.** O Silábico Cree e o Cirílico são Unicode comuns — eles são renderizados em qualquer lugar — e ambas as ortografias estão em uso real. O Champollion não escolherá o sistema de escrita de uma comunidade em nome de um projeto: `init` pergunta quando você seleciona o idioma, e `sync` se recusa a ser executado até que a configuração diga qual:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**Escritas PUA (tlh, x-elvish-s, x-kryptonian) têm como padrão a romanização.** pIqaD, Tengwar e Kryptoniano *não estão no Unicode* — os conversores emitem codepoints da Área de Uso Privado (Private Use Area) que não renderizam nada, a menos que você envie uma fonte mapeada para esses codepoints. A romanização é a única saída que é renderizada em qualquer lugar, portanto, é o padrão. Para emitir a escrita de exibição em vez disso:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…e execute `champollion fonts install` para que seu site tenha uma fonte que possa desenhá-la. Se suas fontes estiverem vinculadas à transliteração latina (muitas fontes de conlang estão), mantenha o padrão.

`script` aceita um código ISO 15924, com qualquer capitalização (`"cans"`, `"Cans"` e `"CANS"` são o mesmo). Ele também pode ser definido por par, o que prevalece sobre o nível do idioma. Um valor inválido, ou uma escrita que a localidade não pode produzir, falha na inicialização — antes de qualquer chamada de API.

### Letras não mapeadas e `scriptFallback` {#script-fallback}

Os conversores traduzem o que sua ortografia define e nada mais. A romanização Klingon não tem `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` ou `z` — portanto, a saída do modelo contendo um substantivo próprio como "GitHub" não pode ser totalmente convertida. O Champollion **nunca escreve um valor parcialmente convertido**: se alguma letra não puder ser mapeada, todo o valor permanecerá na escrita de trabalho, e o aviso nomeia as letras mais a linha de configuração que as mapearia.

Esses mapeamentos são seus para declarar:

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

Cada regra substitui uma sequência da escrita de trabalho por uma que o conversor *pode* mapear, antes que a conversão seja executada. As regras são validadas na inicialização — uma substituição que por si só não pode ser mapeada é rejeitada.

O Champollion **não inclui regras de fallback próprias**: inventar adaptações ortográficas, especialmente para o sistema de escrita de um idioma real, não é uma decisão que cabe a um índice tomar. Comunidades e fandoms têm convenções — adote-as deliberadamente, por projeto.

### Corrigindo conversão indesejada {#repair-script}

Antes da versão 0.3.0, a conversão era incondicional — projetos direcionados às localidades PUA obtinham saídas não renderizáveis, quer quisessem ou não. Duas ferramentas fecham o ciclo:

- **`champollion repair-script`** verifica localidades cuja configuração diz que a conversão está *desativada* para codepoints PUA e restaura a romanização usando a própria tabela reversa do conversor (`--dry` para visualizar). pIqaD reverte exatamente; as reversões de Tengwar e Kryptoniano perdem a capitalização e avisam sobre isso.
- **`champollion integrity`** falha (exit 1) ao encontrar PUA onde a conversão está desativada — para que um gate de build capture texto não renderizável antes de ser enviado, e o relatório nomeia a correção.

A Memória de Tradução (Translation Memory) nunca precisa de correção: ela armazena valores pré-conversão, portanto, ativar ou desativar `script:` posteriormente não requer trabalho de cache.

A conversão de escrita se aplica a strings de UI (arquivos de chave-valor e JSON do Docusaurus). Corpos em Markdown nunca são convertidos — um conversor de caracteres ganancioso não tem um caminho seguro através de trechos de código, URLs e front matter.

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
      "model": "google/gemini-2.5-pro"
    },
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

### Campos de Par

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `method` | `string` | Método de tradução: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api` |
| `methodPlugin` | `string` | Nome de um plugin instalado (de `.champollion/methods/`) |
| `model` | `string` | Sobrescreva o modelo padrão para este par |
| `temperature` | `number` | Sobrescreva a temperatura padrão para este par |
| `batchSize` | `number` | Sobrescreva o tamanho de lote padrão para este par |
| `register` | `string` | Sobrescrita de registro/tom (chave predefinida ou texto livre) |
| `endpoint` | `string` | URL de endpoint de API remota. Obrigatório quando `method` é `api`. |
| `coachingFile` | `string` | Caminho para arquivo de prompt de coaching para este par |
| `promptContext` | `string` | Contexto da aplicação para este par |
| `qualityTier` | `string` | Nível de exibição: `standard`, `high`, `research`, `verified` |

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
      "model": "google/gemini-2.5-pro",
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
| `register` | `string` | Instruções de estilo/tom. Pode ser uma **chave predefinida** (ex., `casual-tu`, `formal-hapsyo`) ou texto personalizado. Consulte [Cartões de Idioma](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Nome do idioma legível por humanos (para exibição de status) |
| `model` | `string` | Substitui o modelo padrão |
| `temperature` | `number` | Substitui a temperatura padrão |
| `batchSize` | `number` | Substitui o tamanho do lote padrão |
| `coachingFile` | `string` | Caminho para um arquivo de prompt de instrução para este idioma |
| `promptContext` | `string` | Contexto da aplicação para este idioma |
| `maxRetries` | `number` | Orçamento máximo de tentativas para lotes que falharam (padrão: 3) |
| `script` | `string` | Código ISO 15924 da ortografia que o Champollion escreve (ex., `"Cans"`, `"Piqd"`). Consulte [Conversão de Escrita](#script-conversion). |
| `scriptFallback` | `object` | Regras de transliteração para letras que o conversor de escrita não pode mapear. Consulte [Conversão de Escrita](#script-conversion). |

:::info[Cadeia de herança]
As configurações são resolvidas nesta ordem (a primeira vence):

**nível de par** → **nível de idioma** → **configuração global** → **padrões**

Por exemplo, se `pairs["en:fr"]` define `model`, ele sobrescreve tanto o nível de idioma quanto os valores globais de `model`.
:::

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

Champollion cria `.champollion.lock` para rastrear hashes SHA-256 de valores de origem traduzidos. **Faça commit deste arquivo** para que todos os desenvolvedores compartilhem a mesma linha de base de tradução.

Quando um valor de origem muda, o hash não corresponde mais, e champollion retraduz essa chave na próxima sincronização.

## `.champollionignore`

Crie `.champollionignore` na raiz do seu projeto para excluir arquivos da varredura de `lint`. Usa padrões glob, como `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## Diretório `.champollion/`

Champollion cria um diretório `.champollion/` na raiz do seu projeto para estado interno. Você geralmente deve **adicionar isto a `.gitignore`** — é otimização local, não fonte do projeto:

```gitignore
.champollion/
```

| Arquivo | Propósito | Fazer commit? |
|---------|----------|--------|
| `tm.json` | Cache de Memória de Tradução — armazena traduções anteriores indexadas por texto de origem + locale + método | Não (cache local) |
| `xliff/*.xliff` | Arquivos de exportação XLIFF para revisão de tradutor profissional | Não (transitório) |
| `methods/` | Manifestos de plugin de método instalado | Sim (configuração compartilhada) |
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
| `DirectLLMMethod` | Classe base para provedores LLM diretos (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Classes de provedor LLM direto |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Classes de MT tradicional |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | LLM com coaching (OpenRouter + dados de coaching) |
| `APIMethod` | Cliente de API remota |
| `runSync`, `runContentSync` | Pipeline de sincronização completo |
| `resolveConfig`, `resolvePairs` | Resolução de configuração |
| `validateTranslations` | Portão de qualidade |
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
