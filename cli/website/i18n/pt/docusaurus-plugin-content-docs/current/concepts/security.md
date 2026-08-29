---
sidebar_position: 4
title: "Segurança"
---

# Segurança & Proteção

Champollion foi projetado para ser seguro em ambientes adversariais — onde dados de locale podem vir de fontes não confiáveis, onde nomes de arquivo elaborados poderiam escapar dos limites de diretório, e onde a saída de LLM pode conter qualquer coisa.

## Modelo de Ameaça

| Ameaça | Vetor de Ataque | Mitigação |
|--------|--------------|-----------|
| **Prototype pollution** | Chaves JSON elaboradas (`__proto__`, `constructor`) | Rejeitadas no tempo de análise |
| **Path traversal** | Códigos de locale como `../../etc/passwd` | Escritas de arquivo validadas para diretórios configurados |
| **Corrupção de bloco de código** | LLM traduz dentro de cercas de código | Proteção por sentinela Unicode |
| **Chaves alucinadas** | LLM retorna chaves que não foram enviadas | Validação de resposta — apenas chaves aceitas são escritas |
| **Gasto de token descontrolado** | Loops de retry infinitos | Orçamento limitado via `maxRetries` |

## Proteção contra Prototype Pollution

Todas as chaves de locale são validadas contra uma lista de bloqueio antes do processamento:

- `__proto__`
- `constructor`
- `prototype`

Qualquer chave que corresponda a esses padrões é rejeitada com um erro. Isso impede que atacantes usem arquivos de locale elaborados para modificar protótipos de objetos JavaScript.

## Contenção de Caminho

Ao escrever arquivos de locale, champollion valida que o caminho de saída permanece dentro dos diretórios configurados (`localesDir`, `contentDir`). Códigos de locale são sanitizados — um código como `../../secrets` não pode escrever fora do diretório esperado.

## Proteção de Bloco

Durante a tradução de conteúdo Markdown, elementos estruturados são substituídos por placeholders sentinela Unicode antes do texto ser enviado ao LLM:

1. **Blocos de código** (cercados e inline) → sentinela
2. **Shortcodes Hugo** (`{{< >}}`, `{{% %}}`) → sentinela  
3. **HTML bruto** → sentinela
4. **Variáveis de interpolação** (`{{ .Count }}`) → sentinela

Após a tradução, sentinelas são substituídos pelo conteúdo original. O LLM nunca vê blocos de código, shortcodes ou HTML — não pode corrompê-los.

## Validação de Resposta

Quando o LLM retorna uma resposta JSON, champollion valida que:
- Apenas chaves que foram enviadas no lote aparecem na resposta
- Nenhuma chave extra é injetada
- A resposta é analisada como JSON válido

Chaves alucinadas são silenciosamente descartadas. Isso impede que a saída do LLM injete traduções inesperadas em seus arquivos de locale.

## Portão de Qualidade

Cada tradução é validada através de cinco verificações determinísticas antes de ser escrita em disco. Veja [Portão de Qualidade](/docs/concepts/quality-gate) para detalhes.

## Backoff Exponencial

Chamadas de API usam backoff exponencial com jitter em respostas 429 (limite de taxa) e 5xx (erro de servidor). Três tentativas com atraso crescente evitam sobrecarregar a API durante interrupções.

## Timeout de Requisição

Cada requisição de API tem um timeout de 30 segundos via `AbortController`. Isso impede que o processo de sincronização fique pendurado indefinidamente em uma conexão morta.

## Falhas de Tradução Ruidosas

Quando a API está indisponível ou uma tradução falha, champollion lança um erro ruidoso com orientação acionável em vez de escrever silenciosamente lixo. Nenhum placeholder prefixado com `[EN]` é jamais escrito durante a sincronização.

```
[ERR] Content sync for fr: no API key available.
  Set OPENROUTER_API_KEY in .env.local to translate content.
```

A falha de um arquivo não interrompe toda a sincronização — o erro é registrado e o pipeline continua para o próximo arquivo, para que você obtenha o máximo de progresso por execução.

## Verificação Pós-Sincronização

Após todas as traduções serem concluídas, champollion relê os arquivos de locale escritos em disco e executa uma passagem de verificação. Isso detecta a lacuna entre a sincronização relatar sucesso e as traduções estarem erradas na prática:

- **Paridade de chaves** — todas as chaves de origem presentes em cada alvo
- **Marcadores `[EN]`** — marcadores de fallback legados de execuções anteriores
- **Traduções vazias** — valores em branco que escaparam
- **Conformidade de script** — locales não-latinos com traduções apenas em ASCII
- **Preservação de placeholder** — placeholders ICU correspondem à origem

Pule com `--no-verify` ou execute de forma independente com `npx champollion verify`.

## Testes

Propriedades de segurança são verificadas pela suite de testes adversariais:

```bash
npm run test:redteam    # prototype pollution, path traversal, encoding attacks
```

---

## Veja Também

- [Arquitetura](/docs/concepts/architecture) — como o ecossistema de três peças se conecta
- [Referência CLI — integridade](/docs/reference/cli#integrity) — comando de verificação de integridade
- [Referência CLI — proveniência](/docs/reference/cli#provenance) — comando de auditoria de proveniência
- [Especificação de Plugin](/docs/reference/plugin-spec) — campos de proveniência em manifestos de plugin
- [Portão de Qualidade](/docs/concepts/quality-gate) — verificações de segurança no nível de tradução
