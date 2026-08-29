---
sidebar_position: 6
title: "Solução de Problemas"
---

# Solução de Problemas

Problemas comuns e soluções para champollion.

## API & Autenticação

### "OPENROUTER_API_KEY not found"

Champollion requer uma chave de API para tradução com LLM. Configure-a como uma variável de ambiente:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

Ou em um arquivo `.env` (se seu projeto carrega arquivos `.env`):

```
OPENROUTER_API_KEY=sk-or-v1-...
```

:::tip
Se você só tem uma chave de API do Google Translate, champollion detecta automaticamente e usa Google Translate como método padrão. Nenhuma mudança de configuração necessária.
:::

### "401 Unauthorized" do OpenRouter

Sua chave de API é inválida ou expirou. Verifique em [openrouter.ai/keys](https://openrouter.ai/keys).

### "429 Too Many Requests" / Limite de Taxa

Champollion trata limites de taxa internamente com backoff exponencial. Se você consistentemente atinge limites de taxa:

1. **Reduza o tamanho do lote** em sua configuração:
   ```json
   { "batchSize": 15 }
   ```
2. **Use um modelo com limites de taxa mais altos** (ex: `google/gemini-3.5-flash` tem limites generosos)
3. **Use um método mais barato/rápido** para pares de alto volume — Google Translate não tem limites de taxa:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Modelo Não Encontrado / Erros 404

Provedores LLM diretos (`openai`, `anthropic`, `gemini`) validam sua string de modelo no primeiro uso. Se você vir um aviso:

**"looks like an OpenRouter path"** — Você está usando um modelo no formato OpenRouter (`google/gemini-3.5-flash`) com um provedor direto. Provedores diretos usam nomes de modelo simples:

```diff
- { "method": "gemini", "model": "google/gemini-3.5-flash" }
+ { "method": "gemini", "model": "gemini-2.5-flash" }
```

Ou mude para o método `llm` para usar OpenRouter:
```json
{ "method": "llm", "model": "google/gemini-3.5-flash" }
```

**"is an Anthropic/OpenAI/Gemini model"** — Você está enviando um modelo para o provedor errado:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — O modelo pode estar descontinuado ou com erro de digitação. Champollion busca a lista de modelos ao vivo do provedor e sugere alternativas. Verifique a documentação do provedor para nomes de modelos atuais.

:::tip[Descontinuação de modelos acontece]
Provedores descontinuam nomes de modelos regularmente. Se as traduções falharem repentinamente após uma atualização do provedor, verifique a saída `[WARN]` — ela mostrará as alternativas atuais.
:::

## Qualidade da Tradução

### Traduções ecoam o idioma de origem

O portão de qualidade detecta isso. Se uma tradução é idêntica à fonte em inglês, ela é rejeitada e retentada. Se persistir:

1. **Verifique o modelo** — Alguns modelos têm desempenho ruim para pares de idiomas específicos
2. **Adicione instruções de registro** — Diga ao modelo qual idioma produzir:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Tente um modelo diferente** — Mude de `gpt-4o-mini` para `gpt-4o` ou `google/gemini-2.5-pro`

### Saída de script errada (ex: texto latino para japonês)

O portão de qualidade detecta a maioria dos casos com a verificação de conformidade de script. Se persistir:

- Verifique se o código de locale está correto (`ja`, não `jp`)
- Adicione instruções explícitas de script no campo `register`:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### Padrões de alucinação na saída

Padrões de trigrama repetidos (ex: "hello hello hello") são detectados pelo detector de loop de alucinação. Se a saída está corrompida mas passa pelo detector:

1. **Reduza o tamanho do lote** — Lotes menores produzem saída mais focada
2. **Use um modelo mais forte** — Modelos maiores alucinam menos em scripts não-latinos
3. **Adicione dados de coaching** — Termos de dicionário ancoram a tradução

## Problemas de Arquivo & Formato

### "No locale files found"

Champollion detecta automaticamente arquivos de locale. Se não conseguir encontrá-los:

1. **Verifique `localesDir`** — Deve apontar para o diretório contendo arquivos de locale:
   ```json
   { "localesDir": "./locales" }
   ```
2. **Verifique nomenclatura de arquivo** — Arquivos devem ser nomeados por código de locale: `en.json`, `fr.json`, etc.
3. **Verifique formato** — Formatos suportados: JSON, JSON aninhado, YAML, TOML

### Conflitos de arquivo de lock

Se `.champollion.lock` entra em um estado ruim:

```bash
# Reset the lock file (next sync will retranslate everything)
rm .champollion.lock
npx champollion sync
```

:::warning
Deletar o arquivo de lock significa que a próxima sincronização retraduzirá todas as chaves, não apenas as alteradas. Isso tem implicações de custo de API para projetos grandes.
:::

### Retraduzindo chaves específicas

Se traduções individuais estão erradas e você quer forçá-las a serem retraduzidas sem deletar o arquivo de lock:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

A flag `--force-keys` sobrescreve a verificação de hash do arquivo de lock para essas chaves específicas, forçando retradução sem afetar nenhuma outra chave.

### Tradução de conteúdo corrompe blocos de código

Isso não deveria acontecer — blocos de código são protegidos antes da tradução. Se acontecer:

1. Verifique se o bloco de código usa cercas padrão (três backticks)
2. Verifique blocos de código não fechados no Markdown de origem
3. Abra uma issue — isso é um bug no sistema de proteção de sentinela

## Problemas de CLI

### `--watch` não detecta mudanças

Monitoramento de arquivo usa `fs.watch` nativo do Node.js. Problemas conhecidos:

- **Unidades de rede** — `fs.watch` não funciona confiável em montagens NFS/SMB
- **Volumes Docker** — Use modo de polling ou execute champollion dentro do container
- **Diretórios grandes** — O monitor observa `localesDir` recursivamente; árvores muito profundas podem exceder limites do SO

### `npx` executa uma versão antiga

```bash
# Clear the npx cache
npx --yes champollion@latest sync
```

Ou instale globalmente:

```bash
npm install -g champollion
champollion sync
```

## Performance

### Sincronização é lenta para muitos idiomas

Champollion traduz todos os locales em paralelo por padrão. Se a sincronização ainda está lenta:

1. **Use Google Translate para pares de alto volume** — É 10–50× mais rápido que tradução com LLM
2. **Aumente o tamanho do lote** (padrão é 80):
   ```json
   { "batchSize": 120 }
   ```
3. **Ajuste concorrência** — Paralelismo de locale JSON padrão é 200 e conteúdo é 48. Se seu provedor de API suporta limites de taxa mais altos:
   ```bash
   npx champollion sync --json-concurrency 80 --content-concurrency 20
   ```
4. **Use um modelo rápido** — `gpt-4o-mini` é significativamente mais rápido que `gpt-4o`

### Custos de API altos

- **Verifique tamanhos de lote** — Lotes maiores = menos chamadas de API = custo menor
- **Use Translation Memory** — TM está ativado por padrão. Execute `champollion tm stats` para verificar se está funcionando. Se você vir 0 entradas após múltiplas sincronizações, algo pode estar errado com as permissões do diretório `.champollion/`
- **Use prompt caching** — Champollion divide mensagens de sistema/usuário para cache hits em modelos Anthropic e Google
- **Use Google Translate para idiomas Tier 2** — Veja o cookbook [Traduzir 30 Idiomas](/docs/tutorials/translate-30-languages)

### Traduções obsoletas após trocar provedores

Se você trocar de um método de tradução para outro (ex: `llm` para `deepl`), o cache TM pode ainda servir traduções antigas do método anterior para chaves cujo texto de origem não mudou. A chave de cache inclui o nome do método, então a maioria dos casos é tratada automaticamente. Mas se você mudou `model` dentro do mesmo método:

```bash
# Force fresh translations for all keys
champollion sync --no-tm

# Or clear the cache entirely and re-sync
champollion tm clear --yes
champollion sync
```

Veja [Translation Memory](/docs/concepts/translation-memory) para detalhes sobre design de chave de cache.

## Recuperando-se de uma versão ruim {#recover-old-damage}

Valores gravados por um pipeline mais antigo **nunca se corrigem sozinhos**: os hashes de seus manifestos correspondem à fonte atual, então o `sync` os considera consolidados e nenhum gate os vê novamente. Se você estiver atualizando um projeto que executou versões anteriores à 0.3.0, presuma que pode haver danos em seus arquivos de localidade e faça uma auditoria primeiro:

```bash
champollion integrity
```

A auditoria detecta as assinaturas de danos conhecidas e indica a correção para cada uma:

| Descoberta | O que é | Correção |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Saída de conversão de script (pIqaD/Tengwar/Kryptonian) gravada quando a conversão não era desejada — renderiza em branco | `champollion repair-script` (offline, exato para pIqaD) |
| `HOLLOWED VALUES` | A fonte com suas letras excluídas — saída de antes do gate de preservação de conteúdo | Retraduzir (veja abaixo) |
| `NO-TRANSLATE DRIFT` | Uma URL ou outra chave literal que foi "traduzida" | `champollion sync` (reparado gratuitamente, de forma automática) |

Para valores esvaziados — ou qualquer localidade na qual você simplesmente não confia mais — reconstrua-a:

```bash
champollion sync --pair en:tlh --force
```

O `--force` recoloca na fila cada chave de origem para o(s) par(es) no escopo. Os resultados da Memória de Tradução ainda são utilizados, mas cada resultado utilizado é **validado primeiro pelos gates atuais** — um valor em cache que o gate agora rejeita é descartado e cobrado novamente, para que um cache envenenado se corrija sozinho em vez de alimentar a reconstrução. Adicione `--no-tm` se desejar uma nova cobrança completa de qualquer forma, e `--max-cost` para limitar o gasto em ambos os casos.

A verificação pós-sincronização também relata essas assinaturas, de modo que uma localidade danificada falha no `sync` de forma ruidosa (com a correção indicada) em vez de ser enviada silenciosamente.

### Uma recolocação na fila única após limpezas com `--no-tm` {#one-time-requeue}

Se a sua recuperação usou `--no-tm`, espere que a **próxima** sincronização coloque na fila um lote de chaves que ecoam a origem que você achava que estavam consolidadas. O `--no-tm` grava valores sem registrá-los na Memória de Tradução, e um valor *não registrado* idêntico à sua origem é indistinguível de um não traduzido — portanto, ele é recolocado na fila uma vez, retorna (frequentemente idêntico), é registrado e se consolida permanentemente. Este é um custo único, não um loop. Visualize exatamente quais chaves com:

```bash
champollion sync --dry --list-keys
```

## Ainda Preso?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — Procure issues existentes ou abra uma nova
- **[Documentação de Arquitetura](/docs/concepts/architecture)** — Entenda o design do sistema
- **[Portão de Qualidade](/docs/concepts/quality-gate)** — Como a validação funciona nos bastidores
