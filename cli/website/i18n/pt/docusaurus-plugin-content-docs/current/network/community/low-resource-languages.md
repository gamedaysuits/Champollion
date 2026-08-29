---
sidebar_position: 5
title: "Dar suporte a um idioma de poucos recursos"
related:
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "The first step for an uncovered language"
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
  - label: "Plains Cree, the trading card"
    to: https://champollion.dev/trading-cards?q=crk
    kind: card
    note: "The proof-of-concept language, as a card"
---

# Suporte a uma Língua de Baixo Recurso

> **Resumo Executivo.** Um guia abrangente para construir tradução automática para línguas de baixo recurso e polissintéticas. Aborda por que essas línguas são difíceis (complexidade morfológica, dados esparsos, alucinação), recursos computacionais existentes (ALTLab FST, GiellaLT, Apertium, UniMorph, EdTeKLA), mais de 10 estratégias de abordagem, o sistema de coaching do champollion e o ciclo de avaliação. Comece por aqui se você quiser contribuir com um método para uma língua sub-representada.

:::info[Status: Em Desenvolvimento Ativo]
O suporte ao Plains Cree (nêhiyawêwin) está atualmente em desenvolvimento. As ferramentas, o harness de avaliação e o leaderboard descritos aqui são reais e utilizáveis hoje, mas o pipeline de tradução do Cree ainda não foi lançado. Quando for, servirá como modelo para outras línguas polissintéticas e de baixo recurso com infraestrutura FST.
:::

## O Problema Não Resolvido

O serviço Cloud Translation do Google lista 194 idiomas ([lista publicada pelo Google](https://docs.cloud.google.com/translate/docs/languages)). O OMT-1600 da Meta (março de 2026) afirma ter cobertura para 1.600 — o maior sistema de tradução automática (MT) já publicado. Mas para as ~1.200 línguas em sua cauda longa — nossa matemática: as 1.600 que ele cobre menos as mais de 400 que seus autores relatam que os modelos "entendem suficientemente bem" — a qualidade está abaixo dos limites utilizáveis, os dados de treinamento são dominados por textos bíblicos, os pesos do modelo não estão disponíveis para download e não há avaliação independente ou estrutura de governança comunitária. Para as ~5.400 línguas restantes, nenhum modelo pré-treinado produz qualquer saída.

O cenário mudou significativamente — as Big Techs agora estão investindo na cobertura de línguas de baixo recurso (LRL). Mas cobertura não é qualidade, e qualidade sem verificação independente não gera confiança. Línguas de baixo recurso precisam de mais do que um modelo que afirme cobri-las — elas precisam de avaliação independente com validação morfológica, corpora com curadoria da comunidade e governança que respeite a soberania.

**O champollion foi construído para mudar isso.**

O [Leaderboard de Métodos](https://champollion.dev/leaderboard) é um desafio aberto: construa o melhor método de tradução para uma língua sub-representada, prove-o com uma avaliação reprodutível e conquiste a pontuação máxima. Qualquer pessoa no mundo pode contribuir — linguistas, pesquisadores de ML, trabalhadores comunitários de línguas, estudantes, entusiastas. O problema não está resolvido. A infraestrutura está aqui. O leaderboard está esperando.

---

## Por Que Isso É Difícil: Morfologia Polissintética

A maioria dos sistemas comerciais de tradução automática foi projetada para línguas como inglês, francês e chinês — línguas onde as palavras são relativamente curtas e as frases são construídas a partir de tokens discretos. Mas muitas línguas indígenas, incluindo o Plains Cree, são **polissintéticas**: uma única palavra pode codificar o que o inglês expressa como uma frase inteira.

### O exemplo do Cree

Considere a palavra em Plains Cree:

> **ê-kî-nitawi-kîskinwahamâkosiyân**
> *"quando eu fui para a escola"*

Isso é **uma palavra**. Ela codifica tempo (passado), direção (indo para), a raiz (aprender), voz (passiva/reflexiva) e pessoa (primeira do singular). Um LLM treinado predominantemente em inglês não tem intuição para esse tipo de densidade morfológica.

Os desafios se acumulam:

| Desafio | O Que Significa |
|-----------|--------------|
| **Complexidade morfológica** | Uma única raiz verbal pode gerar milhares de formas flexionadas válidas por meio de prefixação, sufixação e circunfixação |
| **Distinção animado/inanimado** | Os substantivos são gramaticalmente animados ou inanimados — isso afeta a conjugação verbal, os demonstrativos e a pluralização. A classificação nem sempre segue a animação biológica (*askiy* "terra" é animado; *maskisin* "sapato" também é animado) |
| **Obviação** | As referências de terceira pessoa são classificadas por proximidade/saliência. A distinção entre "próximo" (proximate) e "obviativo" (obviative) não tem equivalente em inglês |
| **Dados de treinamento esparsos** | Os LLMs viram muito pouco texto em Plains Cree. O que eles viram pode misturar dialetos (dialeto Y, dialeto TH) ou ortografias (SRO vs. silábicos) |
| **Baseline comercial fraco** | O OMT-1600 inclui CRK no nível R1 (Recurso Muito Baixo) com treinamento no domínio da Bíblia e tokenização BPE padrão. O Google Tradutor não suporta Cree. A avaliação independente com métricas morfológicas é o que torna esses baselines significativos. |

A tradução de línguas polissintéticas continua sendo um **problema de pesquisa em aberto** — o OMT-1600 inclui línguas polissintéticas, mas usa tokenização BPE padrão (vocabulário de 256K) sem nenhuma consciência morfológica, o que significa que ele fragmenta palavras composicionais em fragmentos de bytes sem sentido.

---

## Estado da Arte: Como as Pessoas Têm Abordado Isso

### O FST do ALTLab

O recurso computacional mais significativo para o Plains Cree é o **transdutor de estados finitos (FST)** desenvolvido pelo [Alberta Language Technology Lab (ALTLab)](https://altlab.ualberta.ca/) na Universidade de Alberta, em colaboração com o [Giellatekno](https://giellatekno.uit.no/) na UiT A Universidade Ártica da Noruega.

O FST do ALTLab é um **analisador e gerador morfológico**: dada uma palavra flexionada em Cree, ele pode decompô-la em sua raiz e tags gramaticais, e dada uma raiz mais tags, ele pode gerar a forma flexionada correta. Isso é determinístico — sem rede neural, sem alucinação, sem probabilidade. Se o FST aceita uma palavra, essa palavra é morfologicamente válida.

É por isso que o leaderboard do champollion rastreia a **Taxa de Aceitação do FST** como uma métrica. Um método de tradução que produz palavras que o FST rejeita está produzindo um Cree morfologicamente inválido — independentemente do que a pontuação chrF++ diga.

**Principais recursos do ALTLab:**
- [itwêwina](https://itwewina.altlab.app/) — um dicionário inteligente de Plains Cree–Inglês alimentado pelo FST
- [Morphodict](https://github.com/UAlbertaALTLab/morphodict) — plataforma de dicionário de código aberto com consciência morfológica
- [crk-db](https://github.com/UAlbertaALTLab/crk-db) — banco de dados lexical do Plains Cree
- [21st Century Tools for Indigenous Languages](https://21c.tools/) — o contexto mais amplo do projeto

### FST Global e Registros Morfológicos

O Plains Cree não é a única língua com infraestrutura FST de alta qualidade. Se você deseja desenvolver pipelines de tradução para outras línguas de baixo recurso ou morfologicamente complexas, pode aproveitar esses hubs globais estabelecidos:

* **[GiellaLT / Giellatekno](https://giellalt.github.io/) (UiT A Universidade Ártica da Noruega):** O maior repositório de analisadores e geradores morfológicos FST de código aberto, cobrindo mais de 100 línguas. As áreas de foco incluem línguas Sámi (`sme`, `smj`, `sma`, etc.), línguas urálicas (Komi, Erzya, Udmurt, etc.) e outras línguas minoritárias/indígenas. Eles hospedam corpora de texto processado público (`corpus-xxx`) em sua [Organização no GitHub](https://github.com/giellalt/).
* **[The Apertium Project](https://www.apertium.org/):** Uma plataforma de tradução automática baseada em regras de código aberto. O Apertium mantém analisadores morfológicos FST altamente otimizados (usando `lttoolbox` e `hfst`) e dicionários bilíngues para dezenas de línguas, incluindo um grande conjunto de línguas túrquicas (Cazaque, Tártaro, Quirguiz, etc.) e línguas europeias minoritárias. Todos os recursos são públicos no [GitHub do Apertium](https://github.com/apertium).
* **[UniMorph (Universal Morphology)](https://unimorph.github.io/):** Um projeto colaborativo que fornece paradigmas morfológicos padronizados para mais de 150 línguas. O conjunto de dados está hospedado no Hugging Face em [unimorph/universal_morphologies](https://huggingface.co/datasets/unimorph/universal_morphologies). Se um binário FST compilado não estiver disponível para uma língua, as tabelas do UniMorph podem ser usadas como um portão de busca de banco de dados estático.
* **[National Research Council Canada (NRC)](https://nrc-digital-repository.canada.ca/):** Oferece ferramentas para línguas indígenas canadenses, incluindo o analisador morfológico FST de Inuktitut **Uqailaut** e o enorme **Nunavut Hansard Parallel Corpus** (1,3 milhão de pares de frases alinhadas em Inglês-Inuktitut).

### O Corpus EdTeKLA

O [grupo de pesquisa EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) (também na UAlberta) reuniu um corpus da língua Plains Cree a partir de materiais educacionais, transcrições de áudio e fontes da comunidade. O conjunto de dados de avaliação do champollion [EDTeKLA Dev v1](/docs/network/leaderboard/datasets) é derivado deste trabalho, publicado sob a [CC BY-NC-SA modificada do EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (termos não comerciais, com escopo de soberania).

### Outras abordagens que as pessoas tentaram ou poderiam tentar

O leaderboard é agnóstico em relação ao método. Aqui estão estratégias que foram exploradas ou propostas para MT de baixo recurso, qualquer uma das quais poderia ser submetida:

| Abordagem | Como Funciona | Prós | Contras |
|----------|-------------|------|------|
| **[Prompting de LLM com coaching](/docs/network/tutorials/coached-llm-prompting)** | Injeta regras gramaticais, dicionários e pares de exemplos no prompt do sistema | Rápido para iterar, não requer treinamento | Teto de qualidade limitado pelo conhecimento base do LLM |
| **[Prompting few-shot](/docs/network/tutorials/few-shot-prompting)** | Inclui traduções verificadas como exemplos no contexto | Bom para estilo consistente | Janela de contexto pequena; os exemplos NÃO devem vir dos dados de avaliação |
| **[Pipeline com portão FST](/docs/network/tutorials/fst-gated-pipeline)** | LLM gera → FST valida → rejeita e tenta novamente morfologia inválida | Garante validade morfológica | Requer infraestrutura FST; loops de repetição adicionam latência e custo |
| **[Busca em dicionário + LLM](/docs/network/tutorials/dictionary-augmented-llm)** | Força termos conhecidos de um dicionário bilíngue, deixa o LLM lidar com o resto | Reduz a alucinação para termos conhecidos | A cobertura do dicionário é sempre incompleta |
| **[Modelo com fine-tuning](/docs/network/tutorials/fine-tuned-model)** | Faz o fine-tuning de um modelo aberto (Llama, Mistral) em texto paralelo — apenas não nos dados de avaliação | Potencialmente a mais alta qualidade | Requer corpus paralelo (escasso); caro; risco de overfitting |
| **[Modelos encadeados](/docs/network/tutorials/chained-models)** | Modelo A gera tradução bruta → Modelo B pós-edita → Modelo C pontua | Pode combinar pontos fortes de especialistas | Complexo; lento; caro |
| **[Híbrido baseado em regras + LLM](/docs/network/tutorials/rule-based-hybrid)** | Usa regras linguísticas para padrões conhecidos, LLM para todo o resto | Preciso onde as regras se aplicam | Requer profunda especialização linguística |
| **[Aumento por retrotradução (back-translation)](/docs/network/tutorials/back-translation)** | Gera dados paralelos sintéticos traduzindo Cree→Inglês e, em seguida, treinando no reverso | Expande os dados de treinamento de forma barata | Amplifica os erros existentes do modelo |
| **[Abordagem evolutiva](/docs/network/tutorials/evolutionary-approach)** | Gera traduções candidatas, pontua-as, sofre mutação nos melhores desempenhos, repete | Pode descobrir soluções inovadoras; paralelizável | Computacionalmente caro; precisa de uma boa função de aptidão |
| **[Tradução parcial](/docs/network/tutorials/partial-translation)** | Traduz manualmente uma amostra representativa, prova que seu método corresponde ao seu estilo nela e, em seguida, traduz automaticamente o volume restante | Combina qualidade humana com escala de máquina | Requer esforço humano inicial |
| **JSON manual / correção de exames** | Cria manualmente um arquivo JSON de conjunto de dados para testar as respostas dos alunos em um exame de idioma ou avalia um lote de traduções humanas em relação a um padrão-ouro | Zero ML necessário; funciona para educação e QA | Não escala para necessidades contínuas de tradução |

### É apenas JSON

O harness recebe JSON como entrada e gera JSON pontuado como saída. O [formato do conjunto de dados](/docs/network/leaderboard/datasets) é simples:

```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

Você pode construir isso manualmente. Você pode exportar de uma planilha. Você pode gerar a partir de um corpus. Um professor de idiomas poderia usá-lo para pontuar as traduções dos alunos. Uma agência de tradução poderia usá-lo para avaliar freelancers. Um laboratório de pesquisa poderia usá-lo para comparar arquiteturas de modelos. O harness não se importa de onde o JSON veio — ele apenas o pontua.

E como o framework de implantação em produção usa a mesma interface de plugin, um método que pontua bem no harness é implantado no seu site com uma alteração de configuração. **Prove e use.**

As possibilidades são genuinamente infinitas. **Se você tem uma ideia, construa-a, execute o harness e envie suas pontuações.**

---

## Como o champollion se Encaixa

O champollion fornece a camada de infraestrutura — você traz o método.

### O sistema de coaching

O método `llm-coached` do champollion permite que você injete conhecimento linguístico diretamente no prompt do LLM:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation, demonstratives, and pluralization",
    "Use SRO (Standard Roman Orthography) as the working script — syllabic conversion is handled by the deterministic converter",
    "Obviation: when two third-person referents appear, the less salient one takes obviative marking (-a suffix on nouns, -iyiwa on verbs)"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "dashboard": "kīskinwahamākēwin-māsinahikan"
  },
  "style_notes": "Use formal register appropriate for educational and community contexts. Preserve English technical terms in parentheses when no Cree equivalent exists or is widely accepted."
}
```

Os dados de coaching são injetados em cada prompt do LLM para o par `en:crk`, dando ao modelo um contexto linguístico estruturado que ele não teria de outra forma. Veja [Dados de Coaching](https://champollion.dev/docs/concepts/coaching-data) para a especificação completa.

### Registros

O registro faz parte do prompt do sistema que direciona o tom, a formalidade e as convenções ortográficas. O champollion vem com um registro para o Plains Cree:

```
nêhiyawêwin (Plains Cree). Use SRO (Standard Roman Orthography) as the working
script. Output will be converted to Syllabics via deterministic converter.
Professional register appropriate for educational and community contexts.
```

Você pode substituir isso na sua configuração para experimentar diferentes estratégias de prompting:

```json title="champollion.config.json"
{
  "languages": {
    "crk": {
      "register": "Casual Plains Cree (Y-dialect). Use SRO. Prefer everyday vocabulary over formal or archaic terms. Address the reader directly."
    }
  }
}
```

Diferentes registros produzem diferentes estilos de tradução — e diferentes pontuações no leaderboard. Cada submissão registra o registro exato e o prompt do sistema usados (como um hash SHA-256 no [run card](/docs/network/specifications/run-card)), para que os experimentos sejam reprodutíveis.

### Conversão de script

O Plains Cree é escrito em dois scripts: **Ortografia Romana Padrão (SRO)** e **Silábicos Aborígenes Canadenses**. O pipeline do champollion:

1. O LLM traduz para SRO (baseado em latim, com o qual os LLMs lidam melhor)
2. O portão de qualidade valida a saída SRO
3. O conversor determinístico transforma SRO → Silábicos
4. O texto convertido é gravado no disco

O conversor lida com todos os diacríticos SRO (ê, î, ô, â para vogais longas) e os mapeia para os caracteres silábicos corretos. Veja [Conversores de Script](https://champollion.dev/docs/concepts/script-converters) para detalhes técnicos.

### O ciclo de avaliação

O [harness de avaliação](/docs/network/specifications/harness) executa seu método contra o conjunto de dados de avaliação e produz um [run card](/docs/network/specifications/run-card) pontuado:

```bash
# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness

# Run a baseline experiment
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v7

# Run with FST validation (the default LLM method gates on the FST)
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --fst-retries 3 \
  --name fst-gated-v1
```

A flag `--name` é um rótulo que você escolhe. Ela aparece no leaderboard para que as pessoas possam ver qual estratégia de prompt você usou. O harness registra o prompt completo do sistema no run card, para que sua abordagem exata seja reprodutível.

:::tip[Experimente livremente, envie o seu melhor]
O harness foi projetado para iteração rápida. Execute dezenas de experimentos com diferentes modelos, dados de coaching, registros e condições. Envie para o leaderboard apenas quando tiver algo do qual se orgulhe.
:::

---

## Princípios de Soberania de Dados {#data-sovereignty-principles}

O champollion foi projetado para apoiar a soberania de dados indígenas. A propriedade, o controle, o acesso e a posse comunitários dos dados linguísticos orientam como abordamos a tecnologia de idiomas para comunidades indígenas:

| Princípio | Como o champollion o apoia |
|-----------|------------------------|
| **Propriedade** | As comunidades linguísticas são donas de seus dados linguísticos. O champollion nunca envia telemetria ou transmite dados para nossos servidores |
| **Controle** | O [método de API](https://champollion.dev/docs/guides/serving-a-method) permite que as comunidades hospedem seu próprio pipeline de tradução — nós fornecemos a interface, elas controlam a implementação |
| **Acesso** | As comunidades decidem quem pode usar seu método. A API pode ser restrita por autenticação |
| **Posse** | Todos os dados de tradução permanecem no sistema de arquivos do seu projeto. O [sistema de proveniência](https://champollion.dev/docs/concepts/security) rastreia de onde veio cada tradução |

A arquitetura de plugins significa que uma comunidade pode construir um método que incorpore conhecimento sagrado ou restrito internamente, expor apenas a API de tradução e manter controle total sobre seus recursos linguísticos.

---

## A Visão: O Que Vem a Seguir

O Plains Cree é o primeiro alvo. Uma vez que o pipeline seja validado e a comunidade esteja satisfeita com a qualidade, a mesma arquitetura se estende a outras línguas polissintéticas com infraestrutura FST:

- **Outras línguas algonquinas**: Woods Cree, Swampy Cree, Ojibwe, Blackfoot
- **Línguas inuítes**: Inuktitut, Inuinnaqtun (que também usam scripts silábicos)
- **Outras famílias linguísticas**: qualquer língua com um analisador FST pode usar o pipeline com portão FST

O leaderboard tem escopo por par de idiomas. À medida que novos conjuntos de dados de avaliação são contribuídos por comunidades linguísticas, novas trilhas do leaderboard são abertas automaticamente.

**Este é um convite aberto.** Se você trabalha com uma língua de baixo recurso — como pesquisador, membro da comunidade, estudante ou apenas alguém que se importa —, o champollion oferece as ferramentas para construir algo real, medi-lo honestamente e compartilhá-lo com o mundo. O [Leaderboard de Métodos](https://champollion.dev/leaderboard) está esperando pela sua submissão.

---

## Veja Também

- **[Leaderboard de Métodos](https://champollion.dev/leaderboard)** — envie suas pontuações e veja como os métodos se comparam
- **[Avaliação de MT](/docs/network/leaderboard/rules)** — o que faz um bom método, o que é desqualificado
- **[Harness de Avaliação](/docs/network/specifications/harness)** — como executar experimentos
- **[Conjuntos de Dados de Avaliação](/docs/network/leaderboard/datasets)** — EDTeKLA Dev v1 e FLORES+
- **[Dados de Coaching](https://champollion.dev/docs/concepts/coaching-data)** — como estruturar o conhecimento linguístico para o LLM
- **[Conversores de Script](https://champollion.dev/docs/concepts/script-converters)** — o pipeline SRO→Silábicos
- **[Servindo um Método via API](https://champollion.dev/docs/guides/serving-a-method)** — hospedando tradução controlada pela comunidade
- **[ALTLab](https://altlab.ualberta.ca/)** — o Alberta Language Technology Lab
- **[EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/)** — o grupo de pesquisa Educational Technology, Knowledge & Language
- **[Dicionário itwêwina](https://itwewina.altlab.app/)** — dicionário Plains Cree–Inglês alimentado por FST
