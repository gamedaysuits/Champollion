---
sidebar_position: 1
title: "Referência da CLI"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Referência da CLI

## Comandos

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List all untranslated [EN] fallback values
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and quality tiers
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion leaderboard       Browse and install methods from the Network leaderboard
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion card <code>       Pretty-print a language card (--json for raw output)
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
champollion recommend         Method guidance for a pair — availability + cited evidence
champollion register-corpus   Register a corpus: pick a license + exposure tier (local-only/private/public/sealed)
champollion submit            Propose an index entry (review-gated): prints a pre-filled GitHub issue
champollion seal-corpus <sub> Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
```

Execute `champollion <command> --help` para obter ajuda detalhada sobre qualquer comando.

## Opções Globais

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Hugo/Docusaurus content directory for Markdown translation
--source <code>         Override source locale (default: en)
--model <model>         Override translation model (full slug or alias from shared/model-aliases.json)
--method <method>       Translation method: llm, google-translate (default: from config)
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--force                 Re-queue every source key (whole-locale rebuild; scope with --pair)
--force-content         Re-translate all content files (clears content lock)
--force-keys <keys>     Comma-separated dot-notation keys to force re-translate
--no-tm                 Skip Translation Memory cache for this sync run
--no-verify             Skip post-sync verification pass
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

---

## init

Assistente de configuração interativa que cria `champollion.config.json`. Orienta você através da locale de origem, idiomas de destino, formato de arquivo e modelo de tradução.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
```

**Opção `--langs`**: Lista separada por vírgulas de códigos de idioma de destino. Pula o prompt de idioma e aplica presets de registro padrão para cada idioma. Combine com `--yes` para configuração totalmente não-interativa.

**Presets de idioma**: Quando solicitado pelos idiomas de destino, você pode digitar nomes de presets:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Misture presets e códigos individuais: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Traduz chaves ausentes e obsoletas em todos os arquivos de locale. Executa verificação pós-sincronização por padrão.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --force-keys "hero.title"         # force re-translate
champollion sync --force-keys "a.title,a.subtitle" # multiple keys
champollion sync --pair en:tlh --force             # rebuild one whole locale
champollion sync --pair en:tlh --force --no-tm     # ...bypassing a suspect cache
champollion sync --force-content                   # re-translate all Markdown/MDX
champollion sync --content-dir ./content           # include Hugo Markdown
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Memória de Tradução**: Por padrão, `sync` carrega `.champollion/tm.json` e fornece traduções em cache para valores de origem inalterados. Use `--no-tm` para contornar o cache (útil ao trocar provedores de tradução ou depurar qualidade). Veja [Memória de Tradução](/docs/concepts/translation-memory).

**Detecção de mudanças**: champollion armazena hashes SHA-256 em `.champollion.lock`. Quando valores de origem mudam, a próxima sincronização retraduz automaticamente essas chaves. Faça commit do arquivo de lock para que todos os desenvolvedores compartilhem a linha de base.

**Paralelismo**: Tanto a tradução de chaves JSON quanto a tradução de conteúdo são executadas em paralelo. Locales JSON são traduzidas simultaneamente (padrão: 200 locales concorrentes), com lotes dentro de cada locale também paralelizados (4 lotes concorrentes). A tradução de conteúdo (Markdown, MDX, posts de blog) é executada em um pool de itens de trabalho plano (padrão: 48 chamadas de API concorrentes). Substitua com `--json-concurrency`, `--content-concurrency` ou `--concurrency` (define ambos).

**Saída**: Sync exibe um banner de versão, detecção de formato/framework, estimativa de custo e barras de progresso por locale:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

As barras de progresso são atualizadas no local após cada lote (~80 chaves). Use `--quiet` apenas para erros/avisos, ou `--json` para saída NDJSON legível por máquina. Ambas suprimem a barra de progresso e o banner.

---

## watch

Sincronização automática quando o arquivo de locale de origem muda. Executa até ser interrompido com `Ctrl+C`.

```bash
champollion watch
```

---

## audit

Lista todos os valores de fallback com prefixo `[EN]` não traduzidos de execuções anteriores. Sai com código 1 se algum for encontrado — use como um gate de CI para falhar builds com traduções incompletas.

```bash
champollion audit
```

---

## verify

Relê todos os arquivos de locale do disco e verifica se as traduções estão realmente presentes e corretas. Esta é a mesma verificação que é executada automaticamente ao final de cada `sync` (a menos que `--no-verify` seja passado).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify && echo "All good" # CI gate
```

**O que verifica:**
- Paridade de chaves — todas as chaves de origem presentes em cada destino
- Marcadores de fallback `[EN]` de execuções anteriores
- Traduções vazias
- Conformidade de script — locales não-latinas devem ter traduções não-ASCII
- Preservação de placeholders — placeholders ICU correspondem à origem
- Problemas de codificação — marcadores BOM, caracteres invisíveis
- Ecos de origem — valores idênticos à origem (aviso)

---

## lint

Verifica o código-fonte em busca de strings hardcoded voltadas ao usuário que devem usar chamadas de tradução i18n. Detecta automaticamente seu framework (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**O que detecta:**
- Strings hardcoded em texto JSX, `placeholder`, `alt`, `aria-label`, `title`
- Arquivos com conteúdo voltado ao usuário mas sem importação de framework i18n
- Chaves mortas — chaves de locale que nenhum arquivo de origem referencia
- Pontuação de cobertura — percentual de strings passando por i18n

**Exclusões**: Crie `.champollionignore` na raiz do seu projeto (padrões glob, como `.gitignore`).

---

## wrap

Envolve automaticamente strings hardcoded detectadas por `lint` em chamadas `t()`. Cria backups automáticos antes de modificar arquivos.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Gates de segurança:**
1. Verificação de limpeza do Git (pulada em dry-run)
2. Backup automático para `.champollion-backup/`
3. Visualização de diff antes de cada escrita de arquivo
4. Suporte `--undo` para restaurar do backup

---

## seo

Gera artefatos de SEO para sites multilíngues.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Subcomando | Saída |
|------------|--------|
| `hreflang` | Tags `<link rel="alternate" hreflang>` |
| `sitemap` | `sitemap.xml` multilíngue |
| `jsonld` | Schema JSON-LD WebSite de idioma |

---

## integrity

Detecta corrupção e desvio em arquivos de locale traduzidos.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**O que ele verifica:**
- Corrupção de placeholders (ex.: `{name}` presente na origem, mas ausente no destino)
- Problemas de codificação (mojibake, Unicode inválido)
- Cópias não traduzidas (valor de destino idêntico à origem) — chaves [`noTranslate`](/docs/getting-started/configuration#no-translate) estão isentas, assim como ecos que a Translation Memory confirma como produzidos pelo pipeline e aprovados pelo gate. O que permanece sinalizado é exatamente o que `sync` recolocaria na fila — as duas ferramentas não podem discordar sobre um arquivo saudável
- Desvio de não tradução (uma chave `noTranslate` que *não* é idêntica à origem) — relatado com valores esperados/reais e caracteres invisíveis escapados; execute `champollion sync` para reparar
- PUA inesperado (pontos de código da Área de Uso Privado em uma localidade cuja [conversão de script](/docs/getting-started/configuration#script-conversion) está desativada — renderiza em branco sem uma fonte especial); execute `champollion repair-script` para reparar
- Valores esvaziados (um destino que é sua origem com as letras excluídas — dano de um pipeline mais antigo que o gate de preservação de conteúdo); traduza novamente com `sync --force-keys <key>` ou `sync --pair <pair> --force`
- Chaves órfãs (chaves no destino que não existem na origem)
- Completude das categorias de plural do ICU MessageFormat (ex.: o árabe precisa de 6 categorias)

---

## repair-script

Reverte a conversão de script que nunca deveria ter acontecido: valores codificados em PUA (pIqaD, Tengwar, Kryptoniano) em localidades cuja configuração diz que a conversão está desativada são restaurados para a romanização por meio da própria tabela reversa do conversor.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Opção | Efeito |
|--------|--------|
| `--dry` | Visualizar reparos sem gravar |
| `--locale <code>` | Reparar apenas uma localidade |
| `--json` | Saída JSON legível por máquina |
| `--warn-only` | Sair com 0 mesmo se restar PUA irreversível |

pIqaD é revertido exatamente. As reversões de Tengwar e Kryptoniano não conseguem recuperar a capitalização (sinalizado como perda de capitalização). A Translation Memory não precisa de reparo — ela armazena valores pré-conversão. Sai com 1 quando resta PUA que nenhum conversor registrado consegue reverter.

---

## tm

Gerencia o cache de Memória de Tradução (`.champollion/tm.json`). TM armazena traduções anteriores e as fornece em sincronizações subsequentes em vez de chamar a API.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Subcomando | Saída |
|------------|--------|
| `stats` | Contagem de entradas, tamanho do arquivo, detalhamento por locale |
| `clear` | Deletar arquivo de cache (completo ou por locale) |

| Opção | Efeito |
|--------|--------|
| `--locale <code>` | Limpar apenas entradas de uma locale |
| `--yes` | Pular prompt de confirmação |

Veja [Memória de Tradução](/docs/concepts/translation-memory) para entender como TM funciona e quando limpá-la.

---

## xliff

Exporta e importa arquivos XLIFF 1.2 para revisão por tradutores profissionais. XLIFF é o formato de troca universal suportado por ferramentas CAT como memoQ, SDL Trados e Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Subcomando | Saída |
|------------|--------|
| `export` | Gera `.xliff` a partir de arquivos de locale de origem + destino |
| `import` | Mescla traduções `.xliff` revisadas em arquivos de locale |

| Opção | Efeito |
|--------|--------|
| `--locale <code>` | Locale de destino para exportação (obrigatório) |
| `--out <path>` | Caminho ou diretório de saída personalizado |
| `--dry` | Visualizar importação sem escrever |

Veja [Trabalhando com Tradutores Profissionais](/docs/guides/professional-translators) para o fluxo de trabalho completo.

---

## status

Mostra configuração de par, plugins instalados, níveis de qualidade e pontuações de benchmark.

```bash
champollion status
```

---

## provenance

Audita licenciamento de recursos de tradução para todos os plugins instalados.

```bash
champollion provenance
```

---

## plugin

Gerencia plugins de método de tradução. Plugins são receitas de tradução pré-empacotadas instaladas em `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove crk-coached-v1     # remove a plugin
```

Veja [Especificação de Plugin](/docs/reference/plugin-spec) para o formato de manifesto do plugin.

---

## leaderboard

Navegue, pesquise e instale métodos de tradução do leaderboard da Network. Métodos instalados do leaderboard vêm com pontuações de benchmark e a MethodConfig canônica completa — a configuração exata usada durante a avaliação.

```bash
champollion leaderboard                          # show leaderboard
champollion leaderboard --pair en:fr             # filter by language pair
champollion leaderboard --install crk-coached-v8 # install a method plugin
champollion leaderboard --install crk-coached-v8 --apply  # install + patch config
```

| Opção | Efeito |
|--------|--------|
| `--pair <code>` | Filtrar leaderboard por par de idiomas (ex: `en:fr`) |
| `--install <name>` | Instalar um plugin de método do leaderboard |
| `--apply` | Após instalação, adicionar automaticamente `methodPlugin` a `champollion.config.json` |

**Fluxo de trabalho `--apply`:** Quando você instala com `--apply`, champollion escreve o plugin de método em `.champollion/methods/` **e** corrige seu `champollion.config.json` para usá-lo para o par relevante. Este é o caminho mais rápido de "o que tem melhor pontuação?" para "estou usando em produção."

---

## fonts

Baixa e gerencia fontes web PUA para conversores de script de linguagem construída. Idiomas que usam caracteres de Área de Uso Privado (Klingon, Sindarin, Kryptoniano) precisam de fontes web personalizadas para renderizar seus scripts. Este comando as baixa de repositórios de código aberto verificados.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Subcomando | Saída |
|------------|--------|
| `list` | Mostra quais fontes PUA são necessárias e seu status de instalação |
| `install` | Baixa fontes para idiomas configurados |

| Opção | Efeito |
|--------|--------|
| `--dir <path>` | Substituir diretório de saída de fonte (auto-detectado do tipo de projeto) |
| `--css` | Gerar um snippet `conlang-fonts.css` junto com as fontes |
| `--config <path>` | Caminho para arquivo de config (usado para detectar quais idiomas precisam de fontes) |

**Auto-detecção:** O diretório de saída é inferido da sua estrutura de projeto:
- **Docusaurus** → `static/fonts/` ou `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Padrão** → `public/fonts/`

**Conversores Unicode nativos** (`crk` → Silábicos Cree, `sr` → Cirílico Sérvio) **não** requerem instalação de fonte.

Veja [Conlangs, Scripts & Ortografia](/docs/guides/conlangs-scripts-orthography) para detalhes completos de fontes PUA.

## Pipeline de Três Camadas

Use `lint`, `sync` e `audit` juntos para i18n à prova de falhas:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Camada | Comando | Quando | Propósito |
|-------|---------|------|---------|
| **Lint** | `lint` | Pré-commit | Bloquear commits com strings hardcoded |
| **Sync** | `sync` | Pós-commit / CI | Traduzir chaves ausentes e alteradas |
| **Verify** | `verify` | Pós-sync / CI | Confirmar que traduções estão presentes e corretas |
| **Audit** | `audit` | Etapa de build | Falhar deployment se alguma locale tiver marcadores `[EN]` |

---

## Veja Também

- [Configuração](/docs/getting-started/configuration) — referência de arquivo de config
- [Métodos de Tradução](/docs/guides/translation-methods) — seleção de método por par
- [Memória de Tradução](/docs/concepts/translation-memory) — cache e economia de custos
- [Trabalhando com Tradutores Profissionais](/docs/guides/professional-translators) — fluxo de trabalho XLIFF
- [Especificação de Plugin](/docs/reference/plugin-spec) — formato de manifesto do plugin
- [Guia de CI/CD](/docs/guides/ci-cd) — automatizando comandos CLI em seu pipeline
- [Como Sync Funciona](/docs/concepts/how-sync-works) — entendendo o pipeline de sync
- [Quality Gate](/docs/concepts/quality-gate) — como traduções são validadas
