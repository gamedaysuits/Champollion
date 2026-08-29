# Champollion

[![versão do npm](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![Licença: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#license)


Traduza seus arquivos de locale com um único comando:

```bash
npx champollion sync
```

O Champollion detecta automaticamente seus arquivos de locale, o formato deles e os idiomas de destino. Ele traduz as chaves ausentes, ignora o que já foi feito e grava os resultados. Simples assim.

> **Parte do Champollion** — infraestrutura de código aberto para tradução automática confiável em todos os idiomas. Esta CLI é a ponta de implantação de um projeto maior que constrói os conjuntos de testes e o mapa mostrando quem pode traduzir o quê, quão bom cada método é em cada tipo de texto e onde ainda estão as lacunas. Ele é executado em dois tipos de benchmark: benchmarks públicos em dados abertos (amplos, baratos, todos os métodos são bem-vindos) e benchmarks soberanos — conjuntos de testes secretos que as comunidades criam, possuem e controlam, e que nós nunca vemos. A infraestrutura é de código aberto e administrada de forma única; os conjuntos de testes e os métodos para o idioma de uma comunidade pertencem a essa comunidade. Construído com as comunidades, nunca extraído delas — elas detêm as chaves. Todo método é bem-vindo, humano e máquina. Explore a rede em [champollion.dev/docs/network](https://champollion.dev/docs/network/).

## Por que não criar seu próprio script?

Você poderia escrever um script rápido que itera sobre suas chaves em inglês e chama o Google Translate. A maioria dos desenvolvedores faz isso — leva cerca de 30 linhas. Eis por que isso falha:

- **Sem detecção de alterações.** Quando você atualiza uma string em inglês, a tradução fica desatualizada para sempre. O Champollion rastreia cada valor de origem com hashes SHA-256 e retraduz apenas o que mudou.
- **Sem processamento em lote (batching).** Uma chamada de API por chave significa 200 chaves = 200 idas e vindas. O Champollion agrupa de forma inteligente (configurável, padrão de 80 chaves/lote para LLM, 128 para o Google).
- **Sem controle de qualidade.** A tradução automática alucina, repete a origem ou gera a saída no sistema de escrita errado. O Champollion valida cada tradução antes de gravá-la — sistema de escrita incorreto, inflação de comprimento e repetições da origem são detectados e rejeitados.
- **Sem reconhecimento de formato.** Codificado rigidamente para JSON? O Champollion lida com JSON, TOML, YAML e Hugo Markdown (frontmatter + corpo) com detecção automática.
- **Sem segurança.** O Champollion protege contra poluição de protótipo, path traversal por meio de códigos de locale manipulados e corrupção de blocos de código durante a tradução de Markdown.

O Champollion é a versão de produção desse script.

> [!NOTE]
> **O que o Champollion traduz.** O Champollion tem como alvo **arquivos de locale e conteúdo estruturado** — pares de chave-valor JSON, configuração TOML/YAML, páginas Hugo Markdown, documentos de intercâmbio XLIFF. Ele é otimizado para texto escrito formal: strings de interface de usuário (UI), documentação, comunicações oficiais, materiais educacionais. Não é um chatbot, tradutor de fala em tempo real ou IA conversacional de uso geral. Para cada par de idiomas, o método de tradução é configurável — desde APIs comerciais (Google Translate, DeepL) até plugins desenvolvidos pela comunidade e avaliados por meio da [MT Eval Arena](https://champollion.dev/arena).

## Início Rápido

```bash
npm install --save-dev champollion
```

### Obtenha uma Chave de API

O Champollion precisa de um backend de tradução. Escolha um:

| Provedor | Chave | Melhor para |
|----------|-----|----------|
| **OpenRouter** (recomendado) | `OPENROUTER_API_KEY` | Projetos com muito conteúdo, Markdown, mais de 200 modelos |
| **OpenAI** | `OPENAI_API_KEY` | Acesso direto ao GPT-4o |
| **Anthropic** | `ANTHROPIC_API_KEY` | Acesso direto ao Claude |
| **Gemini** | `GEMINI_API_KEY` | Nível gratuito disponível |
| **DeepL** | `DEEPL_API_KEY` | Idiomas europeus, suporte a glossário |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | Mais de 130 idiomas, alto volume |

**Início mais rápido** (gratuito): Cadastre-se em [aistudio.google.com](https://aistudio.google.com/apikey) para obter uma chave gratuita do Gemini:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (mais de 200 modelos): Cadastre-se em [openrouter.ai](https://openrouter.ai) e, em seguida:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

Alternativa **Google Translate** (apenas pares de chave-valor — sem reconhecimento de Markdown):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **Nota**: Se apenas `GOOGLE_TRANSLATE_API_KEY` estiver definido, o champollion muda automaticamente para o Google Translate. Nenhuma alteração de configuração é necessária. Usa a API REST diretamente — sem SDK, sem conta de serviço, sem `pip install`. Apenas a chave.

É isso. Para mais controle, crie um arquivo de configuração:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

Cada idioma vem com **predefinições de registro** (register presets) — instruções pré-construídas de tom/formalidade ajustadas ao seu sistema linguístico (vouvoiement para francês, Siezen para alemão, です/ます para japonês, 해요체 para coreano). O assistente de inicialização permite que você navegue e escolha as predefinições, ou passe `--yes` para aceitar os padrões.

### Origem Diferente do Inglês

Se o seu idioma de origem não for o inglês:

```bash
champollion sync --source fr                      # CLI flag
```

Ou defina-o permanentemente em sua configuração:

```json
{ "inputLocale": "fr" }
```

## O Que Ele Faz

Você cuida do framework de i18n (next-intl, i18next, Hugo). O Champollion cuida dos arquivos de tradução.

- **Multiformato** — JSON, TOML, YAML, Hugo Markdown (front matter + corpo) e XLIFF 1.2
- **Incremental** — Traduz apenas o que mudou (rastreamento de hash SHA-256)
- **Em cache** — A Memória de Tradução armazena resultados anteriores; executar a sincronização novamente não custa nada para chaves inalteradas
- **Controle de qualidade** — Valida cada tradução: detecta alucinações, saída no sistema de escrita errado, repetições da origem e inflação de comprimento
- **Reconhecimento de conteúdo** — Métodos LLM protegem blocos de código, shortcodes, links e variáveis de interpolação durante a tradução de Markdown
- **Ferramentas de pipeline** — `lint`, `audit`, `integrity`, `seo` para gates de CI
- **Interoperabilidade XLIFF** — Exporte traduções para revisão profissional em ferramentas CAT (memoQ, SDL Trados, Phrase) e importe-as de volta
- **Dependências mínimas** — duas dependências de tempo de execução (better-sqlite3 para o banco de dados de idiomas empacotado, nomes de locale CLDR); sem SDKs de provedores. Requer Node 20+

## Além do Google Translate

O início rápido coloca você para rodar com um LLM ou o Google Translate. Mas o Google Translate suporta cerca de 130 idiomas. Existem mais de 7.000.

**A ideia central do Champollion: o método de tradução é configurável por par de idiomas.** Use o Google Translate para francês, um LLM com treinamento morfológico para Cree das Planícies e uma API hospedada pela comunidade para quéchua — tudo no mesmo projeto, tudo com a mesma CLI.

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

Se você conseguir descobrir como traduzir um par de idiomas — por meio de engenharia de prompt, dicionários da comunidade, pipelines FST ou modelos ajustados (fine-tuned) — o champollion permite que você empacote esse método como um plugin e o implante junto com todo o resto.

> Nascido da tradução de um site de produção para o Cree das Planícies, onde não existe uma API pronta para uso. A arquitetura por par não é teórica — ela existe porque um projeto precisava do Google Translate para francês e de um pipeline FST treinado para um idioma indígena, rodando lado a lado no mesmo comando de sincronização.

O [MT Eval Harness](https://github.com/gamedaysuits/Champollion) complementar permite que você avalie e compare abordagens de tradução e, em seguida, exporte métodos funcionais como plugins do champollion. Qualquer pessoa que fale ambos os idiomas pode desenvolver, testar e compartilhar um método de tradução — nenhuma plataforma proprietária é necessária.

### Escolha Seu Método

O Champollion suporta 10 métodos de tradução. Cada par de idiomas pode usar um método diferente.

**Provedores de LLM** — melhores para qualidade, com reconhecimento de Markdown, compatíveis com treinamento (coaching):

| Método | Chave | O Que Faz |
|--------|-----|-------------|
| `llm` (padrão) | `OPENROUTER_API_KEY` | LLM via OpenRouter — mais de 200 modelos, roteamento automático |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + regras gramaticais, dicionários, notas de estilo |
| `openai` | `OPENAI_API_KEY` | API direta da OpenAI (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | API direta da Anthropic (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | API direta do Google Gemini (Flash, Pro) — nível gratuito disponível |

**Tradução Automática (MT) Tradicional** — melhor para velocidade, custo e pares de chave-valor de alto volume:

| Método | Chave | O Que Faz |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (mais de 130 idiomas) |
| `deepl` | `DEEPL_API_KEY` | API do DeepL com suporte a glossário (mais de 30 idiomas) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (mais de 100 idiomas) |
| `libretranslate` | *(auto-hospedado)* | LibreTranslate auto-hospedado (AGPL, gratuito) |

**Infraestrutura** — para endpoints personalizados ou hospedados pela comunidade:

| Método | Chave | O Que Faz |
|--------|-----|-------------|
| `api` | *(por provedor)* | Cliente HTTP leve para qualquer endpoint REST |

```bash
# Force a specific method for one run
champollion sync --method deepl

# Or configure per pair
```

```json
{
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

> **Nota**: Os métodos tradicionais de MT (Google Translate, DeepL, Microsoft Translator, LibreTranslate) lidam bem com pares de chave-valor, mas não conseguem traduzir conteúdo Markdown com segurança. Para projetos com muito conteúdo, os métodos LLM são recomendados — eles protegem explicitamente blocos de código, shortcodes e variáveis de interpolação.

## Plugins

Plugins são receitas de tradução pré-empacotadas para pares de idiomas específicos. Eles são manifestos JSON — não código — que dizem ao champollion qual método usar, com quais configurações e qual qualidade foi avaliada.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows quality tiers + benchmarks
```

Consulte [website/docs/reference/plugin-spec.md](../website/docs/reference/plugin-spec.md) para ver o formato do manifesto.

## Comandos

| Comando | Propósito |
|---------|---------|
| `init` | Assistente de configuração interativo (ou `--yes` para padrões rápidos) |
| `sync` | Traduzir e sincronizar todos os arquivos de locale |
| `watch` | Sincronização automática em alterações de arquivo |
| `audit` | Sinalizar locales incompletos (gate de CI) |
| `card` | Imprimir um cartão de idioma formatado (`card <code>`, `--json` para formato bruto) |
| `register-corpus` | Registrar um corpus de avaliação: escolha uma licença + nível de exposição (apenas local/privado/público/selado) |
| `submit` | Propor uma entrada de índice (sujeito a revisão) — imprime uma issue do GitHub pré-preenchida |
| `lint` | Encontrar strings codificadas rigidamente (hardcoded) no código-fonte |
| `status` | Mostrar configuração de pares, métodos, registros e níveis de qualidade |
| `provenance` | Auditar o licenciamento de recursos de tradução |
| `wrap` | Envolver automaticamente strings hardcoded em chamadas `t()` (com desfazer) |
| `seo` | Gerar hreflang, sitemap.xml ou esquema JSON-LD |
| `integrity` | Verificar corrupção de placeholders, codificação e integridade de plurais ICU |
| `plugin` | Instalar, remover ou listar plugins de método |
| `fonts` | Baixar web fonts para conversores de script PUA |
| `tm` | Gerenciar o cache da Memória de Tradução (estatísticas, limpar, por locale) |
| `xliff` | Exportar/importar XLIFF 1.2 para revisão por tradutor profissional |
| `models` | Listar modelos disponíveis para um provedor (`--method gemini`) |
| `verify` | Reler arquivos de locale gravados e confirmar se as traduções estão presentes e corretas (gate de CI) |
| `leaderboard` | Mostrar o placar de líderes de MT (`--pair`, `--sort`, `--install N`) |
| `doctor` | Verificação de integridade do sistema: cartões, configuração, métodos e conversores |

Execute `champollion <command> --help` para obter ajuda detalhada sobre qualquer comando.

Referência completa: [website/docs/reference/cli.md](../website/docs/reference/cli.md)

### Gate de pre-commit

O `champollion lint` foi construído para ser um gate de commit: ele sai com `1` quando encontra strings voltadas para o usuário codificadas rigidamente e `0` quando está limpo (`--warn-only` relata sem bloquear). Conecte-o a um diretório de hooks rastreado em seu projeto:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx champollion lint\n' > .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

Ou acione-o a partir do [lint-staged](https://github.com/lint-staged/lint-staged) para que ele seja executado apenas quando os arquivos de origem estiverem em stage:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

Mantenha o `champollion sync` fora do pre-commit — ele faz chamadas de API de rede, então é lento na melhor das hipóteses e bloqueia commits offline na pior. Em vez disso, execute-o no CI ou em um hook de pre-push, com `champollion audit` / `champollion verify` como o gate.

## Configuração

Crie o `champollion.config.json` ou execute `champollion init`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| Opção | Padrão | Descrição |
|--------|---------|-------------|
| `inputLocale` | `"en"` | Código do idioma de origem |
| `localesDir` | `"./locales"` | Caminho para os arquivos de locale |
| `contentDir` | `null` | Diretório de conteúdo do Hugo (habilita a tradução de Markdown) |
| `format` | `"auto"` | Formato de arquivo: `json`, `toml`, `yaml` ou `auto` |
| `model` | `"google/gemini-3.5-flash"` | Modelo padrão (slug do OpenRouter). Provedores diretos resolvem seu próprio padrão em tempo de execução. Execute `champollion models --method gemini` para descobrir os modelos disponíveis. |
| `defaultMethod` | `"llm"` | Método de tradução padrão (substituído pela flag `--method`) |
| `batchSize` | `80` | Chaves por lote de tradução |
| `pairs` | `{}` | Substituições de método, modelo e qualidade por par |

**Substituições por idioma**: Cada idioma tem um [Cartão de Idioma](../website/docs/reference/language-card-spec.md) — um dos 50 cartões selecionados contendo predefinições de registro, sistemas de formalidade, regras de tipografia e flags de suporte a métodos. Os cartões usam uma [arquitetura de duas camadas](../website/docs/concepts/architecture.md) (tempo de execução + referência) para desempenho em escala. Crie a estrutura de um novo cartão com `node scripts/generate-language-card.mjs <code>`. Use chaves predefinidas como atalho ou escreva um texto de registro personalizado:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "cans"
    }
  }
}
```

**Modo zero-config**: Sem arquivo de configuração? O Champollion detecta automaticamente os arquivos de locale, o formato e os idiomas de destino do seu projeto.

Os valores de idioma podem ser uma chave predefinida (ex., `"casual-tu"`), texto de registro personalizado ou um objeto (controle total). As substituições no nível do par em `pairs` têm prioridade sobre as configurações no nível do idioma. Execute `npx champollion init` para navegar pelas predefinições disponíveis para cada idioma.

Consulte a [Referência da CLI](../website/docs/reference/cli.md) para obter detalhes de configuração específicos do framework.

## Saída da CLI

Quando você executa `sync`, o champollion mostra exatamente o que está acontecendo:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
[INFO] Estimated translation cost:

  Pair       Method   Keys  Est. Cost
  ────────   ──────   ────  ─────────
  en:es-MX   llm      2847    ~$0.8400
  en:fr      deepl    2847    ~$0.5694
  en:it      llm      2847    ~$0.8400

  Total: ~$2.2494

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

A barra de progresso é atualizada no local à medida que cada lote é concluído (~80 chaves por atualização). A detecção de framework mostra `Hugo` quando `contentDir` está definido. A detecção de formato distingue `(auto)` de `(config)` para esclarecer como o formato foi resolvido.

**Modos de saída**: `--quiet` suprime a saída informativa (apenas erros e avisos). `--json` emite NDJSON legível por máquina para pipelines de CI/CD.

## Hardening

- **Exponential backoff** — 3 tentativas com jitter em erros 429/5xx
- **Timeout de requisição de 30s** — AbortController evita travamentos
- **Validação de resposta** — aceita apenas chaves que foram enviadas para tradução
- **Controle de qualidade** — detecta loops de alucinação, saída no sistema de escrita errado, inflação de comprimento e repetições da origem
- **Cascata de tentativas** — em caso de falha na análise (parse) do JSON, tenta novamente o lote → meio lote → chaves individuais (orçamento limitado via `maxRetries`)
- **Memória de Tradução** — `.champollion/tm.json` armazena traduções em cache usando como chave o texto de origem + locale + método; chaves inalteradas são servidas do cache em sincronizações subsequentes, eliminando chamadas de API redundantes
- **Cache de prompt** — a divisão de mensagens de sistema/usuário permite o cache no nível do provedor, reduzindo o custo de tokens entre os lotes
- **Aplicação de terminologia** — traduções treinadas são verificadas em relação aos termos do dicionário após a resposta do LLM
- **Proteção contra poluição de protótipo** — bloqueia `__proto__`, `constructor`, `prototype`
- **Contenção de caminho** — gravações de arquivos são validadas para permanecerem dentro dos diretórios configurados
- **Proteção de blocos** — blocos de código, shortcodes e HTML são protegidos durante a tradução de conteúdo
- **Arquitetura fail-loud** — falhas de tradução sempre lançam exceções com mensagens de erro acionáveis, nunca gravando lixo silenciosamente
- **Verificação pós-sincronização** — o comando `verify` relê os arquivos gravados e confirma se as traduções estão presentes, no sistema de escrita correto e com os placeholders intactos
- **Sucesso parcial** — um lote que falhou não bloqueia o restante

## Testes

```bash
npm test      # all tests
npm run test:unit                # core sync pipeline
npm run test:redteam             # adversarial edge cases
npm run test:format              # TOML/YAML adapters
npm run test:content             # Markdown content parser
npm run test:hugo                # full Hugo E2E
npm run test:lint                # hardcoded string detection
npm run test:pairs               # pair graph resolution
npm run test:methods             # translation method suite
```

**Dependências mínimas** — veja acima.

## Licença

Apache-2.0. A CLI do Champollion é de código aberto — gratuita para instalar, usar, modificar e redistribuir sob os termos da [Licença Apache, Versão 2.0](../LICENSE). O pacote npm `champollion` publicado é Apache-2.0; `cli/LICENSE` é a licença oficial para o pacote distribuído. O MT Eval Harness complementar e as especificações também são de código aberto, licenciados sob AGPL-3.0-or-later — com uma exceção §7 eval-standard-plugin — no [repositório público do harness](https://github.com/gamedaysuits/Champollion).
