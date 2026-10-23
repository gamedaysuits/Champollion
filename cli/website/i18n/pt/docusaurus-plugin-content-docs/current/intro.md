---
sidebar_position: 1
slug: /intro
title: "Tradução de aplicativos e sites"
description: "A referência para traduzir os próprios arquivos de um aplicativo ou site com `champollion sync`: o que ele faz, quando usá-lo e um guia para cada página sobre ele."
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How Sync Works"
    to: /docs/concepts/how-sync-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, machine-translation APIs, your own model — when to use which"
  - label: "Translate an app or website"
    to: /docs/translate-an-app-or-website
    kind: guide
    note: "The same lane, in plain words"
---

# Tradução de aplicativos e sites

O `champollion sync` mantém as traduções de um aplicativo ou site alinhadas com o
seu idioma de origem. Ele lê seus arquivos de localidade (ou suas páginas em Markdown),
encontra o que está faltando ou desatualizado, traduz apenas isso, verifica cada
resultado e o grava de volta no formato do próprio arquivo.

```bash
npx champollion sync
```

Esta seção é a referência para essa trilha. Se você quiser primeiro a versão
em linguagem simples, leia [Traduzir um aplicativo ou site](/docs/translate-an-app-or-website).

## O que o `sync` faz

1. **Encontra seus arquivos.** Ele detecta a pasta e o formato de localidade (JSON, TOML,
   YAML, gettext PO, Flutter ARB) ou uma pasta de páginas Markdown/MDX (Hugo,
   Docusaurus ou qualquer pasta que você indicar com `--content-dir`).
2. **Identifica o que mudou.** Cada valor de origem é registrado pelo seu hash
   SHA-256 em `.champollion.lock`. Chaves ausentes, vazias ou cujo texto de
   origem tenha mudado entram na fila; todo o restante é mantido intacto.
3. **Traduz com o método que você escolheu para cada par.** Um único arquivo de configuração
   pode enviar um par para um LLM, outro para uma API de tradução automática e um terceiro
   para um modelo que você mesmo treinou e hospeda. Métodos de LLM traduzem com
   temperatura 0 por padrão (o único padrão no `shared/model-defaults.json`);
   um modelo hospedado ainda pode variar um pouco entre execuções, o que é um dos motivos
   pelos quais a Memória de Tradução preserva o que já obteve.
4. **Reutiliza o que já foi pago.** A Memória de Tradução armazena em cache cada
   tradução por texto de origem, localidade e método: texto que retorna (uma
   string revertida, a mesma frase em outro arquivo, uma repetição) sai de graça.
5. **Verifica cada resultado antes de gravar.** O gate de qualidade recusa saídas vazias,
   cópias da origem, loops de repetição, saídas no sistema de escrita incorreto,
   placeholders danificados e falhas semelhantes, com uma nova tentativa com feedback. Ele
   detecta saídas corrompidas, não erros de significado.
6. **Verifica após a gravação.** Uma etapa pós-sincronização relê os arquivos gravados e
   verifica a paridade de chaves, valores vazios, sistema de escrita e placeholders;
   `champollion verify` e `champollion audit` executam o mesmo tipo de verificação como
   gates de CI.

Nada é gravado silenciosamente. Uma chave que o gate ainda recusar após a nova tentativa é
deixada sem tradução e relatada, e a sincronização é encerrada com `2`. A recusa é
lembrada para que a próxima sincronização normal não pague ao mesmo modelo pela mesma
resposta: você solicita novamente com `--redo`, adiciona um método `fallback` ao par ou
escreve o valor manualmente.

## Quando usar

- Você tem um aplicativo ou site cujo texto fica em arquivos de localidade ou Markdown
  e quer manter os outros idiomas atualizados conforme o texto de origem muda.
- Você quer um método diferente por par de idiomas em um único projeto, com gastos
  limitados (`--max-cost`) e visíveis antes que qualquer valor seja cobrado (`--dry`).
- Você criou um tradutor nos trilhos e quer que um aplicativo o utilize:
  o `champollion connect` coloca um modelo servido em um projeto de aplicativo, e o `sync`
  passa a traduzir com ele. Um modelo treinado com dados exclusivamente locais só é conectado
  quando os seus detentores concordarem.

O `sync` não é a forma de criar um tradutor para um idioma que nenhum serviço atende
bem. Para isso, comece em [Iniciar um projeto](/docs/start).

## As páginas desta seção

**Primeiros passos**

- [Início rápido](/docs/getting-started/quick-start) — uma primeira sincronização em minutos.
- [Instalação](/docs/getting-started/installation) — requisitos, chaves de API
  e a licença.
- [Configuração](/docs/getting-started/configuration) — todos os campos em
  `champollion.config.json`, configurações por par, layouts de localidade e fallbacks.

**Seu framework e seu pipeline**

- [Integrações de frameworks](/docs/integrations/frameworks) — Hugo, next-intl,
  react-i18next, Flutter e Django com gettext.
- [CI/CD](/docs/guides/ci-cd) — `lint`, `sync`, `verify` e `audit` como gates.
- [Tradução de conteúdo](/docs/guides/content-translation) — páginas em Markdown e MDX,
  front matter e o que é preservado.

**Escolhendo como traduzir**

- [Métodos de tradução](/docs/guides/translation-methods) — cada método,
  sua chave e quando usá-lo.
- [Dados de coaching](/docs/concepts/coaching-data) — notas gramaticais e listas de palavras
  fornecidas a um LLM junto com cada solicitação.
- [Conversores de sistemas de escrita](/docs/concepts/script-converters) e
  [Conlangs, sistemas de escrita e ortografia](/docs/guides/conlangs-scripts-orthography)
  — sistemas de escrita, fontes e línguas inventadas.

**Como funciona por dentro**

- [Como a sincronização funciona](/docs/concepts/how-sync-works) — o pipeline, passo a passo.
- [Memória de tradução](/docs/concepts/translation-memory) — o cache e o que
  ele usa como chave.
- [Quality gate](/docs/concepts/quality-gate) — cada verificação e o que acontece
  com uma chave ou bloco recusado.
- [Segurança](/docs/concepts/security) — chaves e caminhos manipulados, blocos
  de código protegidos e falhas explícitas.

**Pessoas e problemas**

- [Trabalhando com tradutores profissionais](/docs/guides/professional-translators)
  — exportação e importação de XLIFF para revisão.
- [Solução de problemas](/docs/guides/troubleshooting) — erros comuns e soluções.

Todos os comandos e flags estão na [Referência da CLI](/docs/reference/cli), e o
formato dos plugins de método está na [Especificação de plugins](/docs/reference/plugin-spec).

## Licença

A CLI do `champollion` tem código-fonte disponível sob a
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE);
[quem pode utilizá-la](/docs/getting-started/who-may-use-this) explica quem está coberto.
Está com problemas ou quer ajuda com seu projeto? [Vamos conversar](/docs/getting-help).
