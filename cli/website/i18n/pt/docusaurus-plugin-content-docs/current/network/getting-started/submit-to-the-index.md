---
sidebar_position: 0
title: "Enviar para o Índice"
description: "Proponha um dataset, recurso, método, serviço de tradução humana ou resultado externo — ou sugira uma correção no cartão de idioma. Toda submissão passa por revisão humana para garantir a conformidade com propriedade intelectual, licenças e soberania — nada é aprovado automaticamente."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Already have a benchmark run? Publish the run card instead."
  - label: "Registering Corpora"
    to: /docs/network/sovereignty/registering-corpora
    kind: guide
    note: "Exposure tiers for corpora you own"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Honest Limitations"
    to: /docs/network/honest-limitations
    kind: doc
---

# Enviar para o Índice

> **Resumo Executivo.** Proponha algo para o índice Champollion — um benchmark, um recurso, um método de tradução, um serviço de tradução humana, ou um resultado publicado externamente. Você preenche um formulário estruturado curto (no seu navegador ou pela CLI); um **mantenedor revisa cada envio manualmente** para conformidade com IP, licença e comunidade/soberania antes de qualquer coisa ser adicionada. **Nada é aprovado automaticamente.**

O índice é o mapa compartilhado: os datasets nos quais os métodos são avaliados, os dicionários e ferramentas que ajudam, os próprios métodos, as pessoas que traduzem manualmente, e os resultados que outros publicaram. Qualquer pessoa pode propor uma adição. Como essa é uma infraestrutura para comunidades de linguagem, cada proposta passa por um portão de revisão humana primeiro.

---

## O que você pode enviar

| Tipo | O que é | O que adicionamos |
|---|---|---|
| **Benchmark / dataset** | Um corpus de avaliação ou benchmark | Um cartão de metadados + um ponteiro *fetch-from-source* — nunca o conteúdo do corpus |
| **Recurso** | Um dicionário, arquivo, aplicativo, FST (analisador morfológico) ou ferramenta | Uma listagem com um ponteiro + nível de acesso (aberto / restrito / requer consentimento) |
| **Método de tradução** | Um motor de MT, provedor de LLM ou pipeline | Uma entrada no registro de métodos para que possa ser executado e avaliado em benchmark |
| **Serviço de tradução humana** | Um escritório comunitário opt-in, agência ou tradutor individual | Uma listagem por par (os detalhes de contato permanecem out-of-band — nunca na issue pública) |
| **Resultado publicado externo** | Uma pontuação relatada por outro sistema ou artigo científico | Uma **citação** — resultados externos são citados, nunca re-hospedados ou reclassificados como nossa própria medição |
| **Correção de cartão de idioma** | Algo em um [cartão de idioma](/catalogue) está errado, desatualizado ou ausente — uma estimativa de falantes, um status, um sistema de escrita, um recurso que não listamos | Uma **correção citada aplicada na fonte de dados** (os cartões são gerados, para que a correção permaneça); quando as fontes discordam, o cartão mostra todas elas, com as devidas atribuições |

Cada cartão de idioma também possui um link **"Sugerir uma correção ou adição"**
que abre o formulário de correção com o idioma preenchido previamente.

**Solicitações de remoção e restrição da comunidade.** Se você é um membro
ou autoridade da comunidade e deseja que os dados sobre o seu idioma sejam restritos ou removidos, use o
formulário de correção (ou entre em contato com o mantenedor out-of-band se preferir que não seja
público). Estas passam pela [revisão de soberania](/docs/network/sovereignty/data-sovereignty)
com prioridade — nenhuma citação é necessária.

---

## Como funciona a revisão

Essa é a parte importante: **envios são revisados por um humano, não por um robô.** Quando você envia, você abre uma issue no GitHub. Essa issue é a fila de revisão. Um mantenedor a lê e verifica contra as regras do projeto antes de adicionar qualquer coisa:

- **IP & licença.** Devemos ter permissão para listá-lo. Material não-comercial, sem-redistribuição, ou com licença-incerta ainda pode ser *catalogado*, mas fica isolado de qualquer lane comercial / de prêmio / de fetch-público.
- **Comunidade & soberania.** Dados de linguagem indígena e comunitária são listados apenas com o consentimento da comunidade. Um provedor ou custodiante nunca é nomeado publicamente antes de confirmar.
- **Nunca hospedamos conteúdo de corpus.** Datasets são listados como metadados mais um ponteiro para onde os dados são obtidos. **Não cole sentenças de origem/referência em um envio.**
- **Sem dados pessoais.** Sem emails, números de telefone, ou outro PII em uma issue pública. Para serviços de tradução humana, detalhes de contato são fornecidos ao mantenedor fora-de-banda.
- **Escopo.** Bíblia / corpora litúrgicos e outras imposições coloniais estão fora do escopo e serão recusados.

Cada formulário termina com uma atestação obrigatória:

> *"Confirmo que isso é publicamente listável, contém SEM conteúdo de corpus ou dados pessoais, e respeita a licença da fonte e qualquer restrição de comunidade/soberania."*

---

## Duas formas de enviar

### Do seu navegador

Abra o seletor de issue e escolha o formulário que corresponde ao que você está enviando:

➡️ **[Abra um formulário de envio no GitHub](https://github.com/gamedaysuits/Champollion/issues/new/choose)**

Cada formulário pede apenas o que o índice correspondente precisa (nome, linguagens/pares, licença, URL de origem, e assim por diante) e a caixa de atestação.

### Da CLI

Se você tem a [CLI champollion](/docs/network/getting-started/submit-a-method), `champollion submit` coleta os campos e entrega a você uma versão **pré-preenchida** do mesmo formulário do GitHub:

```bash
# Interactive — pick a type and answer the prompts
champollion submit

# See the submission types
champollion submit --list

# Fully scripted (prints a pre-filled GitHub issue URL)
champollion submit --yes --type dataset --attest \
  --field dataset-name="GlobalVoices eng-amh" \
  --field pairs=eng-amh \
  --field license=CC-BY-4.0 \
  --field source-url=https://globalvoices.org
```

A CLI imprime uma URL — abra-a, revise a atestação no navegador, e envie. Adicione `--out submission.json` para também salvar uma cópia local, sem conteúdo, do que você está propondo. A CLI nunca faz upload de nada por si mesma e nunca escreve no índice.

---

## O que acontece depois que você envia

1. Seu envio chega como uma issue no GitHub — a fila de revisão.
2. Um mantenedor a revisa contra as regras de IP / licença / soberania acima.
3. **Se aceito:** o mantenedor adiciona a entrada à fonte-de-verdade relevante (o registro de dataset, um cartão, o registro de método ou serviço humano, ou o catálogo de resultados-externos) através de uma mudança normal, e rotula a issue como **aceito**.
4. **Se não puder ser listado como está:** o mantenedor a rotula como **recusado** (ou pede mais informações) com o motivo.

Não há merge automático e nenhuma publicação automática. Uma pessoa toma a decisão toda vez.

---

## Veja Também

- [Enviar um Método](/docs/network/getting-started/submit-a-method) — já tem uma execução de benchmark? Publique o cartão de execução diretamente.
- [Registrando Corpora](/docs/network/sovereignty/registering-corpora) — níveis de exposição (local / privado / público / selado) para corpora que você possui.
- [Soberania de Dados](/docs/network/sovereignty/data-sovereignty) — como o controle comunitário de dados de linguagem funciona aqui.
- [Para Comunidades de Linguagem](/docs/network/community/for-language-communities) — parceria, consentimento, e custódia de chaves.
