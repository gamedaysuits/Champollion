# Champollion

[![versão npm](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![Licença: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](#license)


**Nos trilhos, com proteções.** Desenvolvimento e
implantação de tradução automática nos trilhos, construído pensando em comunidades
de línguas indígenas e com poucos recursos. Esta CLI é a camada de projeto e implantação.

**Construa um modelo para um idioma**, no seu próprio computador:

```bash
npx champollion new our-language --from English --to "Plains Cree"
cd our-language && npx champollion next
```

Um idioma sem código padrão recebe um código de uso privado e seu próprio nome:
`npx champollion new our-language --from English --to qaa --target-name "Our language"`
(qualquer código de `qaa` a `qtz`).

`champollion new` inicia um projeto com um lugar para cada coisa;
`champollion next` indica o próximo passo — desde os arquivos que uma comunidade mantém
(planilhas, tabelas do Word, dicionários Toolbox ou LIFT, transcrições ELAN)
até um modelo medido e para dentro do seu aplicativo. Cada passo diz quem decide: as pessoas
que detêm o idioma decidem para onde suas frases podem ir e o que é lançado. Um agente de IA
pode seguir os mesmos passos através do
[servidor MCP](https://www.npmjs.com/package/champollion-mcp-server). Os trilhos
prometem processo, não qualidade: você saberá quão bom um modelo é, não que ele
é bom — um primeiro pequeno modelo comunitário geralmente é um guia de conversação medido.
Comece em [champollion.dev/start](https://champollion.dev/start).

**Traduza os arquivos de localidade do seu aplicativo** com um comando:

```bash
npx champollion sync
```

O Champollion detecta automaticamente seus arquivos de localidade, o formato deles e os idiomas de destino. Ele traduz as chaves ausentes, ignora o que já foi feito e grava os resultados — a partir de um mecanismo hospedado ou de um modelo que você construiu e serve por conta própria (`champollion connect`).

**Licença:** código-fonte disponível sob a [Licença PolyForm Noncommercial 1.0.0](../LICENSE) — gratuito para usar, alterar e compartilhar para fins não comerciais (projetos pessoais, pesquisa, ensino e uso por instituições de caridade, escolas e órgãos públicos). O uso para fins comerciais não é coberto por esta licença. O framework de avaliação (evaluation harness) é de código aberto (AGPL-3.0-or-later). [Quem pode usar isso](https://champollion.dev/docs/getting-started/who-may-use-this) · [Detalhes](#license).

## Por que não criar o script você mesmo?

Você poderia escrever um script rápido que itera pelas suas chaves em inglês e chama o Google Translate. A maioria dos desenvolvedores faz isso — leva cerca de 30 linhas. Eis por que isso falha:

- **Sem detecção de alterações.** Quando você atualiza uma string em inglês, a tradução fica desatualizada para sempre. O Champollion rastreia cada valor de origem com hashes SHA-256 e retraduz apenas o que mudou.
- **Sem processamento em lote (batching).** Uma chamada de API por chave significa 200 chaves = 200 idas e vindas. O Champollion agrupa de forma inteligente (configurável, padrão de 80 chaves/lote para LLM, 128 para Google).
- **Sem controle de qualidade (quality gate).** A tradução automática alucina, repete a origem ou gera saída no alfabeto errado. O Champollion verifica cada tradução antes de gravá-la — saídas vazias, repetições da origem, loops de repetição, inflação de comprimento, conteúdo excluído e alfabeto errado são capturados e rejeitados. O controle captura saídas quebradas, não significados errados.
- **Sem reconhecimento de formato.** Codificado rigidamente (hardcoded) para JSON? O Champollion lida com JSON, TOML, YAML e Hugo Markdown (frontmatter + corpo) com detecção automática.
- **Sem segurança.** O Champollion protege contra poluição de protótipo, path traversal via códigos de localidade manipulados e corrupção de blocos de código durante a tradução de Markdown.

O Champollion é a versão de produção desse script.

> [!NOTE]
> **O que o Champollion traduz.** O Champollion tem como alvo **arquivos de localidade e conteúdo estruturado** — pares de chave-valor JSON, configuração TOML/YAML, páginas Hugo Markdown, documentos de intercâmbio XLIFF. Ele é otimizado para texto escrito formal: strings de interface de usuário (UI), documentação, comunicações oficiais, materiais educacionais. Não é um chatbot, tradutor de fala em tempo real ou IA conversacional de uso geral. Para cada par de idiomas, o método de tradução é configurável — desde APIs comerciais (Google Translate, DeepL) até plugins desenvolvidos pela comunidade, benchmarks públicos e modelos que você treina e serve nos trilhos.

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

**Início mais rápido** (gratuito): Inscreva-se em [aistudio.google.com](https://aistudio.google.com/apikey) para obter uma chave gratuita do Gemini:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (mais de 200 modelos): Inscreva-se em [openrouter.ai](https://openrouter.ai), depois:

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

Cada idioma vem com **predefinições de registro (register presets)** — instruções pré-construídas de tom/formalidade ajustadas ao seu sistema linguístico (vouvoiement para francês, Siezen para alemão, です/ます para japonês, 해요체 para coreano). O assistente de inicialização permite que você navegue e escolha predefinições, ou passe `--yes` para aceitar os padrões.

### Origem Não em Inglês

Se o seu idioma de origem não for o inglês:

```bash
champollion sync --source fr                      # CLI flag
```

Ou defina-o permanentemente na sua configuração:

```json
{ "inputLocale": "fr" }
```

## O Que Ele Faz

Você cuida do framework de i18n (next-intl, i18next, Hugo). O Champollion cuida dos arquivos de tradução.

- **Multiformato** — JSON, TOML, YAML, Hugo Markdown (front matter + corpo) e XLIFF 1.2
- **Incremental** — Traduz apenas o que mudou (rastreamento de hash SHA-256)
- **Em cache** — A Memória de Tradução armazena resultados anteriores; executar a sincronização novamente não custa nada para chaves inalteradas
- **Controle de qualidade** — Verifica cada tradução em busca de saídas quebradas: loops de repetição, saída no alfabeto errado, repetições da origem, inflação de comprimento e conteúdo excluído (não verifica o significado)
- **Reconhecimento de conteúdo** — Métodos LLM protegem blocos de código, shortcodes, links e variáveis de interpolação durante a tradução de Markdown
- **Ferramentas de pipeline** — `lint`, `audit`, `integrity`, `seo` para controles de CI
- **Interoperabilidade XLIFF** — Exporte traduções para revisão profissional em ferramentas CAT (memoQ, SDL Trados, Phrase), importe-as de volta
- **Dependências mínimas** — duas dependências em tempo de execução: `@translated/lara` (o SDK do provedor Lara) e `cree-sro-syllabics` (conversor SRO ⇄ silábico de Cree das Planícies do ALTLab/NRC). Requer Node 20+

## Além do Google Translate

O início rápido coloca você para rodar com um LLM ou Google Translate. Mas o Google Translate suporta cerca de 130 idiomas. Existem mais de 7.000.

**A ideia central do Champollion: o método de tradução é configurável por par de idiomas.** Use o Google Translate para francês, um LLM treinado com suas próprias notas gramaticais e dicionário para Cree das Planícies, e uma API que você hospeda para um idioma que nenhum serviço cobre — tudo no mesmo projeto, tudo com a mesma CLI.

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Se você conseguir descobrir como traduzir um par de idiomas — através de engenharia de prompt, dicionários comunitários, pipelines FST ou modelos ajustados (fine-tuned) — o champollion permite que você empacote esse método como um plugin e o implante junto com todo o resto.

> Nascido da tradução de um site de produção para Cree das Planícies, onde não existe uma API pronta para uso. A arquitetura por par não é teórica — ela existe porque um projeto precisava do Google Translate para francês e de um pipeline FST treinado para um idioma indígena, rodando lado a lado no mesmo comando de sincronização.

O [MT Eval Harness](https://github.com/gamedaysuits/Champollion) complementar permite que você faça benchmark e compare abordagens de tradução, e então exporte métodos funcionais como plugins do champollion. Qualquer pessoa que fale ambos os idiomas pode desenvolver, testar e compartilhar um método de tradução — nenhuma plataforma proprietária é necessária.

### Escolha Seu Método

O Champollion suporta 10 métodos de tradução. Cada par de idiomas pode usar um método diferente.

**Provedores de LLM** — melhores para qualidade, com reconhecimento de Markdown, compatíveis com treinamento (coaching):

| Método | Chave | O Que Ele Faz |
|--------|-----|-------------|
| `llm` (padrão) | `OPENROUTER_API_KEY` | LLM via OpenRouter — mais de 200 modelos, roteamento automático |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + regras gramaticais, dicionários, notas de estilo |
| `openai` | `OPENAI_API_KEY` | API direta da OpenAI (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | API direta da Anthropic (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | API direta do Google Gemini (Flash, Pro) — nível gratuito disponível |
| `local` | *(nenhuma)* | Seu próprio modelo atrás de um endpoint compatível com OpenAI (Ollama, vLLM, LM Studio, um modelo treinado com `nmt-forge`). Defina `LOCAL_API_BASE` se não estiver no padrão do Ollama. O texto nunca sai da sua infraestrutura |

**Tradução Automática (MT) Tradicional** — melhor para velocidade, custo e pares de chave-valor de alto volume:

| Método | Chave | O Que Ele Faz |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (mais de 130 idiomas) |
| `deepl` | `DEEPL_API_KEY` | API do DeepL com suporte a glossário (mais de 30 idiomas) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (mais de 100 idiomas) |
| `libretranslate` | *(auto-hospedado)* | LibreTranslate auto-hospedado (AGPL, gratuito) |

**Infraestrutura** — para endpoints personalizados ou hospedados pela comunidade:

| Método | Chave | O Que Ele Faz |
|--------|-----|-------------|
| `api` | *(por provedor)* | Cliente HTTP leve (thin client) para qualquer endpoint REST |

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
    "en:crk": { "method": "llm-coached" }
  }
}
```

> **Nota**: Métodos de MT tradicionais (Google Translate, DeepL, Microsoft Translator, LibreTranslate) lidam bem com pares de chave-valor, mas não conseguem traduzir conteúdo Markdown com segurança. Para projetos com muito conteúdo, métodos LLM são recomendados — eles protegem explicitamente blocos de código, shortcodes e variáveis de interpolação.

## Plugins

Plugins são receitas de tradução pré-empacotadas para pares de idiomas específicos. Eles são manifestos JSON — não código — que dizem ao champollion qual método usar, com quais configurações e qual qualidade foi avaliada (benchmarked).

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows each pair's method, model + plugin benchmarks
```

Consulte [a documentação de referência](https://champollion.dev/docs/reference/plugin-spec) para o formato do manifesto.

## Comandos

| Comando | Propósito |
|---------|---------|
| `init` | Assistente de configuração interativo (ou `--yes` para padrões rápidos) |
| `sync` | Traduzir e sincronizar todos os arquivos de localidade |
| `serve` | Servir a pilha de tradução deste projeto via HTTP (contrato api-method) |
| `watch` | Sincronização automática em alterações de arquivo |
| `audit` | Sinalizar localidades incompletas (controle de CI) |
| `lint` | Encontrar strings codificadas rigidamente (hardcoded) no código-fonte |
| `status` | Mostrar configuração de pares, métodos, registros e benchmarks de plugins |
| `provenance` | Auditar licenciamento de recursos de tradução |
| `wrap` | Envolver automaticamente strings hardcoded em chamadas `t()` (com desfazer) |
| `seo` | Gerar hreflang, sitemap.xml ou esquema JSON-LD |
| `integrity` | Verificar corrupção de placeholders, codificação e integridade de plurais ICU |
| `plugin` | Instalar, remover ou listar plugins de método |
| `fonts` | Baixar fontes da web para conversores de alfabeto PUA |
| `tm` | Gerenciar cache da Memória de Tradução (estatísticas, limpar, semear, podar) |
| `xliff` | Exportar/importar XLIFF 1.2 para revisão por tradutor profissional |
| `models` | Listar modelos disponíveis para um provedor (`--method gemini`) |
| `verify` | Reler arquivos de localidade gravados e confirmar se as traduções estão presentes e corretas (controle de CI) |
| `doctor` | Verificação de integridade do sistema: cartões, configuração, métodos e conversores |

Os comandos que funcionam com o índice compartilhado e o placar de líderes (leaderboard), em vez do seu
projeto, estão agrupados em `champollion network` (cada um também funciona sem o
prefixo):

| Comando | Propósito |
|---------|---------|
| `network card` | Imprimir de forma legível (pretty-print) um cartão de idioma (`network card <code>`, `--json` para formato bruto) |
| `network recommend` | Orientação de método para um par — disponibilidade + evidência citada (`network recommend eng fra`, `--use`, `--json`) |
| `network leaderboard` | Mostrar o placar de líderes de MT (`--pair`, `--sort`, `--install N`) |
| `network register-corpus` | Registrar um corpus de avaliação: escolha uma licença + nível de exposição (apenas local/privado/público/selado) |
| `network seal-corpus` | Verbos criptográficos de nível selado: `keygen` / `seal` / `open` (ponte organizador-nó) |
| `network submit` | Propor uma entrada de índice (sujeito a revisão) — imprime uma issue do GitHub pré-preenchida |

Execute `champollion <command> --help` para obter ajuda detalhada sobre qualquer comando.

Referência completa: [a documentação de referência](https://champollion.dev/docs/reference/cli)

### Controle de pre-commit

O `champollion lint` foi construído para ser um controle de commit: ele sai com `1` quando encontra strings voltadas para o usuário codificadas rigidamente e `0` quando está limpo (`--warn-only` relata sem bloquear). Conecte-o a um diretório de hooks rastreado no seu projeto:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx --yes champollion@0.6 lint\n' > .githooks/pre-commit   # pinned: a new release never changes what the hook runs
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

Mantenha o `champollion sync` fora do pre-commit — ele faz chamadas de API de rede, então é lento na melhor das hipóteses e bloqueia commits offline na pior. Em vez disso, execute-o em CI ou em um hook de pre-push, com `champollion audit` / `champollion verify` como controle.

## Configuração

Crie `champollion.config.json` ou execute `champollion init`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.8-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| Opção | Padrão | Descrição |
|--------|---------|-------------|
| `inputLocale` | `"en"` | Código do idioma de origem |
| `localesDir` | `"./locales"` | Caminho para os arquivos de localidade: um arquivo por idioma (`fr.json`) ou uma pasta por idioma (`fr/common.json`, i18next) |
| `localesPattern` | `null` | Qualquer outro layout, ex. `"src/i18n/{ns}/{lang}.json"` (substitui `localesDir`) |
| `contentDir` | `null` | Pasta de Markdown/MDX para traduzir (um `content/` do Hugo ou qualquer pasta); cada tradução é gravada ao lado de sua origem como `<name>.<locale>.md` |
| `format` | `"auto"` | Formato de arquivo: `json`, `toml`, `yaml` ou `auto` |
| `model` | `"google/gemini-3.8-flash"` | Modelo padrão (slug do OpenRouter). Provedores diretos resolvem seu próprio padrão em tempo de execução. Execute `champollion models --method gemini` para descobrir os modelos disponíveis. |
| `defaultMethod` | `"llm"` | Método de tradução padrão (substituído pela flag `--method`) |
| `batchSize` | `80` | Chaves por lote de tradução |
| `pairs` | `{}` | Substituições de método, modelo e qualidade por par |

**Substituições por idioma**: Cada idioma tem um [Cartão de Idioma (Language Card)](https://champollion.dev/docs/reference/language-card-spec) — um de 50 cartões curados contendo predefinições de registro, sistemas de formalidade, regras de tipografia e flags de suporte a métodos. Os cartões usam uma [arquitetura de duas camadas](https://champollion.dev/docs/agents/rails-model) (tempo de execução + referência) para desempenho em escala. Crie a estrutura de um novo cartão com `node scripts/generate-language-card.mjs <code>`. Use chaves predefinidas como atalho ou escreva um texto de registro personalizado:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
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

**Modo zero-config**: Sem arquivo de configuração? O Champollion detecta automaticamente os arquivos de localidade, o formato e os idiomas de destino do seu projeto.

Os valores de idioma podem ser uma chave predefinida (ex., `"casual-tu"`), texto de registro personalizado ou um objeto (controle total). Substituições no nível do par em `pairs` têm prioridade sobre as configurações no nível do idioma. Execute `npx champollion init` para navegar pelas predefinições disponíveis para cada idioma.

Consulte a [Referência da CLI](https://champollion.dev/docs/reference/cli) para detalhes de configuração específicos do framework.

## Saída da CLI

Quando você executa `sync`, o champollion mostra exatamente o que está acontecendo:

```
champollion v0.4.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
Estimated translation cost:

  Pair      Method    Keys  TM hits   Est. Cost
  ────────  ──────  ──────  ───────  ──────────
  en:es-MX  llm       2847        0    ~$0.3843
  en:fr     deepl     2847        0    ~$1.7794
  en:it     llm       2847        0    ~$0.3843

  Total: ~$2.5480
  Rates: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC; deepl $25.00 per 1M characters — the provider's published price, as checked 2026-06-08. An estimate: ~200 input + ~30 output tokens or ~25 characters per key assumed — the bill depends on the real lengths (--json has the detail).

[INFO] Translating 3 locale(s) with concurrency 50
[INFO] es-MX.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] it.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 8541 keys total — 8541 key(s) sent to the model, 0 served from the cache (free).
```

A última linha da estimativa nomeia a taxa na qual cada valor foi precificado, de onde veio e quando (`--json` traz os detalhes). "Traduzindo …" é dito apenas quando algo será enviado: uma execução de teste (dry run), ou uma execução sem nada para enviar, diz que está verificando as localidades em vez disso. A barra de progresso é atualizada no local à medida que cada lote é concluído (~80 chaves por atualização). Quando `contentDir` está definido, a sincronização nomeia a pasta e para onde vão suas traduções; ela diz `Detected framework: Hugo` apenas quando encontra um site Hugo real (`hugo.toml`, um `config.toml` com configurações do Hugo, `archetypes/`, …). A detecção de formato distingue `(auto)` de `(config)` para esclarecer como o formato foi resolvido.

**Modos de saída**: `--quiet` suprime a saída informativa (apenas erros e avisos). `--json` emite NDJSON legível por máquina para pipelines de CI/CD.

## Fortalecimento (Hardening)

- **Recuo exponencial (Exponential backoff)** — 3 tentativas com variação (jitter) em erros 429/5xx
- **Tempo limite de requisição de 30s** — AbortController evita travamentos
- **Validação de resposta** — aceita apenas chaves que foram enviadas para tradução
- **Controle de qualidade** — captura loops de alucinação, saída no alfabeto errado, inflação de comprimento e repetições da origem
- **Cascata de tentativas** — em caso de falha na análise de JSON, tenta novamente o lote → meio lote → chaves individuais (orçamento limitado via `maxRetries`)
- **Memória de Tradução** — `.champollion/tm.json` armazena em cache traduções indexadas por texto de origem + localidade + método; chaves inalteradas são servidas do cache em sincronizações subsequentes, eliminando chamadas de API redundantes
- **Cache de prompt** — a divisão de mensagens de sistema/usuário permite o cache no nível do provedor, reduzindo o custo de tokens entre lotes
- **Aplicação de terminologia** — traduções treinadas são verificadas em relação aos termos do dicionário após a resposta do LLM
- **Proteção contra poluição de protótipo** — bloqueia `__proto__`, `constructor`, `prototype`
- **Contenção de caminho** — gravações de arquivos validadas para permanecerem dentro dos diretórios configurados
- **Proteção de blocos** — blocos de código, shortcodes e HTML protegidos durante a tradução de conteúdo
- **Arquitetura de falha ruidosa (Fail-loud)** — falhas de tradução sempre lançam exceções com mensagens de erro acionáveis, nunca gravam lixo silenciosamente
- **Verificação pós-sincronização** — o comando `verify` relê os arquivos gravados e confirma se as traduções estão presentes, no alfabeto correto e com os placeholders intactos
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

PolyForm Noncommercial 1.0.0. A CLI do Champollion tem código-fonte disponível — gratuito para instalar, usar e modificar para fins não comerciais (pesquisa, educação, trabalho comunitário) sob a [Licença PolyForm Noncommercial 1.0.0](../LICENSE); o uso para fins comerciais não é coberto por esta licença. Em palavras simples, com exemplos — uma escola, um hospital ou clínica pública, uma instituição de caridade, um projeto pessoal ou de pesquisa estão cobertos; o produto de uma empresa com fins lucrativos, como a vitrine de uma loja, não está: [Quem pode usar isso](https://champollion.dev/docs/getting-started/who-may-use-this) (um resumo, não um aconselhamento jurídico; o texto da licença prevalece). O pacote npm `champollion` publicado é PolyForm-Noncommercial-1.0.0; `cli/LICENSE` é a licença oficial para o pacote distribuído. O MT Eval Harness complementar e as especificações são de código aberto, licenciados sob AGPL-3.0-or-later — com uma exceção §7 eval-standard-plugin — no [repositório público do framework](https://github.com/gamedaysuits/Champollion).
