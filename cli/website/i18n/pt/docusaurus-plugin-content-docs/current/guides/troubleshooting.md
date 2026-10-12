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

1. **Reduza o tamanho do lote** na sua configuração:
   ```json
   { "batchSize": 15 }
   ```
2. **Use um modelo com limites de taxa mais altos** (por ex., `google/gemini-3.8-flash` tem limites generosos)
3. **Use um método mais barato/rápido** para pares de alto volume — o Google Translate não tem limites de taxa:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Modelo Não Encontrado / Erros 404

Provedores diretos de LLM (`openai`, `anthropic`, `gemini`) recebem seus próprios nomes de modelos. Um ID no formato OpenRouter do próprio fornecedor é mapeado para você (`google/gemini-3.8-flash` → `gemini-3.8-flash` no `gemini`). Se a execução for interrompida com:

**"is an OpenRouter model id … which has no model by that name"** — Você está usando um modelo no formato OpenRouter de outro fornecedor (`google/gemini-3.8-flash` com `openai`). Nada foi enviado. Especifique um modelo desse provedor, use o método que possui o modelo ou mude para o método `llm` para usar o OpenRouter — a mensagem indica cada um deles e onde o modelo foi configurado:

```diff
- { "method": "openai", "model": "google/gemini-3.8-flash" }
+ { "method": "openai", "model": "gpt-4o" }
```
```json
{ "method": "llm", "model": "google/gemini-3.8-flash" }
```

Eles também verificam o nome do seu modelo no primeiro uso. Se você vir um aviso:

**"is an Anthropic/OpenAI/Gemini model"** — Você está enviando um modelo para o provedor errado:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — O modelo pode estar descontinuado ou com erro de digitação. Champollion busca a lista de modelos ao vivo do provedor e sugere alternativas. Verifique a documentação do provedor para nomes de modelos atuais.

:::tip[Descontinuação de modelos acontece]
Provedores descontinuam nomes de modelos regularmente. Se as traduções falharem repentinamente após uma atualização do provedor, verifique a saída `[WARN]` — ela mostrará as alternativas atuais.
:::

### `local`: "could not reach …"

O método `local` envia requisições para um servidor compatível com OpenAI na sua máquina (Ollama, vLLM, LM Studio, llama.cpp). Quando não consegue se conectar, o erro informa o endereço que tentou acessar e a configuração que o definiu:

```text
[ERR] Local (OpenAI-compatible) Batch 1 failed: fetch failed (ECONNREFUSED) — could not reach http://localhost:8000/v1 (from LOCAL_API_BASE in .env)
```

O endereço vem da primeira destas opções que estiver definida, no ambiente ou em `.env.local` / `.env`: `LOCAL_API_BASE`, depois `OPENAI_API_BASE` e então `OPENAI_BASE_URL`. Se nenhuma estiver definida, o padrão do Ollama é usado: `http://localhost:11434/v1`. Inicie o servidor ou corrija a configuração indicada pela mensagem.

## Qualidade da Tradução

### Traduções ecoam o idioma de origem

O portão de qualidade detecta isso. Se uma tradução é idêntica à fonte em inglês, ela é rejeitada e retentada. Se persistir:

1. **Verifique o modelo** — Alguns modelos têm desempenho ruim para pares de idiomas específicos
2. **Adicione instruções de registro** — Diga ao modelo que linguagem produzir:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Experimente um modelo diferente** — Mude de `gpt-4o-mini` para `gpt-4o` ou `google/gemini-3.1-pro-preview`

### Saída de script errada (ex: texto latino para japonês)

O portão de qualidade detecta a maioria dos casos com a verificação de conformidade de script. Se persistir:

- Verifique se o código de locale está correto (`ja`, não `jp`)
- Adicione instruções explícitas de script no campo `register`:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### Nomes falham na verificação (por ex., "Curtis Forbes" em japonês)

Nomes estão corretos no alfabeto latino, então informe ao champollion quais são os seus nomes:

```json
{ "protectedTerms": ["Curtis Forbes", "Game Day Suits"] }
```

O modelo é instruído a mantê-los como foram escritos, e um valor composto apenas por esses nomes nunca é reportado como não traduzido ou em escrita incorreta. Sem a lista, um valor curto em escrita latina em um idioma não latino passa por uma nova tentativa perguntando se é um nome ou um rótulo. Se o modelo o mantiver, ele é aceito como um nome e armazenado em cache, de modo que nunca é cobrado novamente. Você não precisa de `--no-verify`.

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

`.champollion.lock` registra a partir de qual texto em inglês cada tradução foi
feita. Resolva um conflito de merge nele como em qualquer arquivo gerado: mantenha qualquer
um dos lados, execute `npx champollion sync` e faça o commit do resultado.

:::warning[Excluir o lock não traduz nada novamente]
Sem o lock, o sync não tem como saber quais strings em inglês mudaram desde que
as traduções existentes foram feitas. Ele traduz apenas chaves que estão **ausentes**
em um arquivo de destino e registra o inglês atual como a nova linha de base. Uma
string em inglês editada antes de o lock ser excluído mantém sua tradução antiga,
silenciosamente. Para reconstruir um locale intencionalmente, use `--force` (delimite-o com
`--pair`); traduções em cache são reutilizadas, portanto apenas textos que o cache nunca
viu são cobrados.
:::

### Retraduzindo chaves específicas

Se traduções individuais estão erradas e você quer forçá-las a serem retraduzidas sem deletar o arquivo de lock:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

A flag `--force-keys` substitui a verificação de hash do lockfile para essas chaves específicas, forçando a retradução sem afetar nenhuma outra chave. `--redo keys:hero.title` é a mesma coisa sob seu nome mais recente. Ambas são atendidas a partir da Memória de Tradução quando ela contém o texto; adicione `--fresh` para pagar por uma nova tradução em vez disso. Uma chave que contenha vírgula (um msgid do gettext é uma frase inteira) é escrita com `\,`, com o argumento entre aspas para o terminal: `--redo 'keys:Welcome back\, %(name)s!'`.

### `verify` relata incompatibilidade de placeholders (ou outro valor danificado)

`champollion verify` (e a verificação executada após cada sync) relata valores que estão danificados: um placeholder que foi perdido ou renomeado, um plural ICU quebrado, um valor com letras apagadas. Um simples `champollion sync` **não** os repara. O valor já está no disco e a entrada no lock diz que ele está atualizado, então o sync o ignora.

Cada ocorrência indica o comando que repara exatamente essas chaves, por exemplo:

```text
[ERR] [VERIFY] fr: 1 i18next {{…}} placeholder mismatch(es): greeting (placeholder {{name}} was changed to {{nom}}) — fix: `champollion sync --pair en:fr --redo keys:greeting`
```

Execute esse comando. Quando um locale abrange vários arquivos, as chaves são escritas como `<file>::<key>` (por exemplo `common::nav.home`), o que retraduz a chave daquele arquivo específico e nenhuma outra.

Você não precisa de `--fresh`. Se o valor danificado veio da Memória de Tradução, `verify` já o removeu do cache e informa isso: `[TM] Evicted 1 cached translation(s) that produced damaged values`. O redo então traduz o texto novamente (ou entrega a tradução do próprio cache, caso diferente) em vez de entregar o valor danificado de volta. Um valor que alguém editou manualmente nunca é armazenado em cache, portanto nada é removido para ele, e o redo funciona da mesma forma.

Para arquivos de conteúdo Markdown/MDX, use `--retranslate` com um caminho ou glob (por ex., `--retranslate docs/intro.md`). Ele traduz esses arquivos do zero, mesmo que estejam atualizados ou tenham sido traduzidos manualmente. Use `--files` para limitar uma execução a alguns arquivos de conteúdo sem forçá-los.

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

### Traduções após trocar de modelo ou provedor

Mudar de método (por ex., de `llm` para `deepl`), registro ou coaching produz traduções novas para o que for traduzido novamente, porque a chave de cache os inclui — mas um sync comum não retraduz nada que já esteja pronto: `champollion sync --redo all` faz isso. Mudar de **modelo** dentro do mesmo método reutiliza o que o modelo anterior traduziu, sem nenhum custo; o sync avisa isso antes da estimativa. Se você quiser as próprias traduções do novo modelo:

```bash
# Have the new model translate what an earlier model wrote
# (what the new model already translated still comes from the cache)
champollion sync --redo all --fresh-on-model-change

# Re-translate specific content files from scratch
champollion sync --retranslate "docs/guides/**"
```

`--fresh-on-model-change` por si só altera apenas as chaves que uma execução traduziria de qualquer forma (novas ou modificadas): após apenas uma troca de modelo, um `sync --fresh-on-model-change` comum não envia nada.

Veja [Translation Memory](/docs/concepts/translation-memory) para detalhes sobre design de chave de cache.

## Recuperando-se de uma versão com problemas {#recover-old-damage}

Valores gravados por um pipeline mais antigo **nunca se corrigem sozinhos**: os hashes do manifesto coincidem com a fonte atual, portanto `sync` os considera resolvidos e nenhum gate os analisa novamente. Se você estiver atualizando um projeto que rodou versões anteriores à 0.3.0, assuma que pode haver dados corrompidos nos seus arquivos de locale e faça uma auditoria primeiro:

```bash
champollion integrity
```

A auditoria detecta as assinaturas de danos conhecidas e indica a correção para cada uma:

| Ocorrência | O que é | Correção |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Saída de conversão de escrita (pIqaD/Tengwar/Kryptonian) gravada quando a conversão não era desejada — renderiza em branco | `champollion repair-script` (offline, exata para pIqaD) |
| `HOLLOWED VALUES` | A fonte com suas letras apagadas — saída anterior ao gate de preservação de conteúdo | Retraduzir (veja abaixo) |
| `NO-TRANSLATE DRIFT` | Uma URL ou outra chave literal que foi "traduzida" | `champollion sync` (reparado gratuitamente, de forma automática) |

Para valores esvaziados — ou qualquer locale no qual você simplesmente não confia mais — reconstrua-o:

```bash
champollion sync --pair en:tlh --force
```

`--force` coloca novamente na fila todas as chaves de origem para o(s) par(es) no escopo. Os resultados da Memória de Tradução ainda são aproveitados, mas cada resultado aproveitado é **validado primeiro em relação aos gates atuais** — um valor em cache que o gate agora rejeita é descartado e cobrado novamente, para que um cache contaminado se cure em vez de alimentar a reconstrução. Adicione `--no-tm` se você quiser uma nova cobrança completa de qualquer forma, e `--max-cost` para limitar os gastos em ambos os casos.

A verificação pós-sync também relata essas assinaturas, para que um locale danificado falhe explicitamente no `sync` (com a correção indicada) em vez de ser publicado silenciosamente.

### Reenfileiramento único após limpezas com `--no-tm` {#one-time-requeue}

Se a sua recuperação usou `--no-tm`, espere que o **próximo** sync coloque na fila um lote de chaves que repetem a origem e que você achava que estavam resolvidas. `--no-tm` grava valores sem registrá-los na Memória de Tradução, e um valor *não registrado* idêntico à sua origem é indistinguível de um não traduzido — portanto, ele entra na fila mais uma vez, retorna (frequentemente idêntico), é registrado e se fixa permanentemente. Esse é um custo único, não um loop. Veja uma prévia exata de quais chaves com:

```bash
champollion sync --dry --list-keys
```

## Ainda Preso?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — Procure issues existentes ou abra uma nova
- **[Documentação de Arquitetura](/docs/concepts/architecture)** — Entenda o design do sistema
- **[Portão de Qualidade](/docs/concepts/quality-gate)** — Como a validação funciona nos bastidores
