---
sidebar_position: 2
title: "Perguntas Frequentes"
related:
  - label: "How It Works"
    to: /docs/network/how-it-works
    kind: doc
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Glossary"
    to: https://champollion.dev/glossary
    kind: glossary
    note: "Plain-language definitions for every technical term"
---

# Perguntas Frequentes

> **Resumo Executivo.** Respostas a perguntas comuns sobre a Champollion Network — como funciona a pontuação, o que resulta em desqualificação, como lidar com idiomas sem FSTs, recomendações de modelos e parâmetros, e o processo de submissão.

---

## Pontuação & Métricas

### Quais métricas o harness calcula?

O harness calcula cinco métricas. Três são agnósticas de linguagem e funcionam para qualquer par de idiomas; duas atualmente dependem de plugins específicos do CRK e serão generalizadas conforme expandimos para mais idiomas. Os corpora de referência executáveis hoje são conjuntos públicos com licença aberta — Global Voices, Tatoeba, TICO-19, IN22, SMOL e mais (veja [Datasets](/docs/network/leaderboard/datasets)) — e o leaderboard está aberto para submissões em todos os pares registrados. Plains Cree é simplesmente onde as duas métricas específicas de linguagem (baseadas em FST) foram implementadas primeiro.

| Métrica | Escala | O Que Mede | Status |
|--------|--------|-----------|--------|
| **chrF++** | 0–100 | Sobreposição de n-gramas de caracteres entre traduções previstas e de referência. Melhor métrica de superfície para idiomas morfologicamente ricos. Usa pontuação nativa do sacrebleu. | ✅ Todos os idiomas |
| **Correspondência exata** | 0.0–1.0 | Proporção de entradas onde a previsão corresponde exatamente à referência após normalização. | ✅ Todos os idiomas |
| **Aceitação FST** | 0.0–1.0 | Proporção de palavras de saída aceitas por um transdutor de estados finitos (analisador morfológico). Calculado apenas quando um binário FST é fornecido. | ✅ Todos os idiomas com FST |
| **Correspondência equivalente** | 0.0–1.0 | Fração de entradas que correspondem à referência ou a uma variante aceitável — levando em conta ordem de palavras, convenção ortográfica e diferenças dialetais. | ⚡ CRK (generalizando) |
| **Pontuação semântica** | 0.0–1.0 | Pontuação de preservação de significado — com que eficiência a tradução captura o significado pretendido independentemente da forma de superfície? | ⚡ CRK (generalizando) |

Métricas adicionais estão planejadas: **precisão morfológica**, **detecção de code-switching**, **aderência terminológica** e **detecção de alucinação**. Veja [Especificação de Pontuação §2](/docs/network/specifications/scoring#2-metric-inventory) para o inventário completo de métricas (seis categorias).

### Como a pontuação composta é calculada?

A composta é uma média ponderada das métricas disponíveis, normalizada para uma escala 0.0–1.0. Os pesos são definidos em dois perfis:

- **Perfil A** (idiomas com FST): 9 métricas, métricas estruturais (FST + precisão morfológica) carregam 40% do peso composto
- **Perfil B** (idiomas sem FST): 8 métricas, semântica e chrF++ carregam peso de topo igual

Quando uma métrica não está disponível, seu peso é redistribuído proporcionalmente entre as métricas restantes. Isso significa que benchmarks em estágio inicial (com apenas chrF++ e correspondência exata disponíveis) ainda produzem compostas válidas — os pesos efetivos apenas refletem o que está disponível.

**As tabelas de peso completas, regras de normalização e justificativa de exclusão estão em [Especificação de Pontuação §4](/docs/network/specifications/scoring#4-composite-score).** O código do harness espelha essas tabelas em `mt_eval_harness/scoring.py`. chrF++ é normalizado dividindo por 100 antes da ponderação; taxas de code-switching e alucinação são invertidas (menor = melhor).

### O que são níveis de qualidade?

Níveis de qualidade são rótulos heurísticos mapeados para intervalos de pontuação composta. Eles ajudam a comunicar o que uma pontuação *significa* na prática:

| Nível | Intervalo Composto | Interpretação |
|------|-------------------|----------------|
| **Baseline** | 0.00 – 0.30 | Abaixo de qualidade útil. O método precisa de melhoria significativa. |
| **Emergente** | 0.30 – 0.50 | Mostra promessa. Algumas traduções estão corretas mas inconsistentes. |
| **Funcional** | 0.50 – 0.70 | Utilizável como referência com revisão humana. Não adequado para implantação sem revisão. |
| **Implantável** | 0.70 – 0.85 | Pronto para uso em produção com revisão periódica. Dispara elegibilidade de transferência de propriedade. |
| **Fluente** | 0.85 – 1.00 | Qualidade quase nativa. Adequado para implantação sem supervisão. |

### Qual é a diferença entre níveis de qualidade e níveis de verificação?

**Níveis de qualidade** descrevem *o que a pontuação automatizada significa* (Baseline → Fluente). **Níveis de verificação** descrevem *quem validou o resultado*:

| Nível de Verificação | O que significa |
|-------------------|---------------|
| **Autoavaliado** | O remetente executou o *harness* por conta própria. As pontuações são plausíveis, mas não verificadas. |
| **Verificado pelo Champollion** | Um mantenedor reproduziu o resultado usando a configuração do método enviada. |
| **Validado pela Comunidade** | Falantes bilíngues do idioma de destino, qualificados sob o próprio protocolo da comunidade, revisaram uma amostra estratificada da saída (≥30 entradas, ≥2 revisores) e ≥70% atingiram o padrão da comunidade. Concedido apenas pelos próprios testes da comunidade; o rebaixamento por auditoria pontual é simétrico e igualmente público. |

Um método pode ser qualidade "Implantável" mas apenas verificação "Auto-avaliado" — significando que a pontuação parece ótima mas ninguém confirmou independentemente.

---

## Submissão & Desqualificação

### O que resulta em desqualificação da minha submissão?

Sua submissão será rejeitada ou sinalizada se:

1. **Seu método foi exposto aos dados de avaliação.** Se você treinou, ajustou, fez few-shot-prompt ou de outra forma usou qualquer entrada do conjunto de dados de avaliação, suas pontuações estão artificialmente inflacionadas. Isso inclui usar as traduções de referência em seu prompt.
2. **Seu cartão de execução falha nas verificações de integridade.** A impressão digital deve corresponder à configuração. Cartões de execução adulterados são rejeitados.
3. **Seu método não implementa o protocolo TranslationMethod.** O harness espera `translate(entries, config) → results`. Integrações personalizadas que contornam o harness não são aceitas.

### Posso submeter várias vezes?

Sim. O leaderboard rastreia todas as submissões. Você pode iterar — executar dezenas de experimentos, submeter apenas o melhor. Cada submissão registra uma impressão digital única, então não há ambiguidade sobre qual execução produziu qual pontuação.

### Como faço para verificar minha pontuação?

1. **Autoavaliado (automático):** Toda submissão começa aqui.
2. **Verificado pelo Champollion (automático):** O servidor recalcula a pontuação das suas saídas enviadas em relação ao corpus de referência fixado por SHA (*sha-pinned*) com a métrica do *harness*. Quando sua pontuação é reproduzida, a execução é promovida para Verificado pelo Champollion — o único nível que o quadro de líderes classifica. Se não for reproduzida, ou se uma referência armazenada foi alterada, a execução é desqualificada.
3. **Validado pela Comunidade:** Falantes bilíngues do idioma de destino, qualificados sob o próprio protocolo da comunidade, revisam uma amostra estratificada da saída do seu método — pelo menos 30 entradas, pelo menos 2 revisores — e pelo menos 70% devem atingir o padrão da comunidade. O nível é concedido apenas por testes que a própria comunidade executa, a seu critério, e pode ser revogado da mesma forma: uma auditoria pontual reprovada rebaixa o método de forma igualmente pública. Isso não pode ser automatizado — requer o engajamento da comunidade.

### Por que vocês não reexecutam o método de todos para verificá-lo?

Porque não temos condições financeiras e não precisamos. O servidor recalcula a pontuação das saídas enviadas por *todos* gratuitamente (isso captura pontuações digitadas manualmente ou editadas). Reexecutar um modelo de fato custa processamento real, então fazemos isso em uma **amostra** escolhida por **auditoria ponderada por reputação**: uma execução sempre é reexecutada se for de alto risco (se cria a primeira ponte para toda uma família de idiomas) ou anômala (um salto bom demais para ser verdade em relação ao melhor anterior), e, para contribuidores comprovados, é verificada por amostragem raramente. A reputação é conquistada apenas ao passar por essas auditorias (ou por um contribuidor independente corroborando seu resultado) — nunca por volume — de modo que identidades descartáveis novas não ganham nada. Uma falsificação descoberta zera a reputação de um contribuidor, reaudita todo o seu histórico verificado e é registrada publicamente, como uma retratação. Nós **não** afirmamos que sua execução "passou pelo *harness*" — para processamento auto-hospedado que não é verificável pelo servidor — portanto, a validade se baseia em *reprodutibilidade + risco de reputação + corroboração*, não em atestado. Consulte as [Regras de Avaliação de MT](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) para ver o modelo completo.

### A API de submissão está ativa?

Ainda não. O endpoint `https://champollion.dev/api/leaderboard/submit` é aspiracional. O caminho de submissão atual é `mt-eval publish` — ele carrega um run card do diretório de saída do harness (`eval/logs/harness/`) diretamente para o leaderboard como *auto-avaliado (não verificado)*.

---

## Modelos & Parâmetros

### Qual modelo devo usar?

Não há um único melhor modelo — depende do par de idiomas, seu orçamento e sua abordagem. Orientação geral:

| Tipo de Idioma | Ponto de Partida Recomendado | Por Quê |
|---------------|---------------------------|-----|
| **Alto recurso** (Francês, Espanhol, Japonês) | `google/gemini-2.5-flash` ou `gpt-4o-mini` | Rápido, barato, baseline forte |
| **Baixo recurso com alguma cobertura LLM** (Quéchua, Iorubá) | `google/gemini-2.5-pro` ou `anthropic/claude-sonnet-4` | Modelos maiores têm melhor conhecimento latente |
| **Polissintético / muito baixo recurso** (Plains Cree, Inuktitut) | `google/gemini-2.5-pro` com coaching | Dados de coaching importam mais que a escolha do modelo. OMT-1600 inclui alguns idiomas polissintéticos (ex., CRK em tier R1) mas com tokenização BPE padrão — faça benchmark como baseline na Network. |

O eval harness usa OpenRouter, então qualquer modelo disponível no OpenRouter pode ser avaliado. Veja [openrouter.ai/models](https://openrouter.ai/models) para a lista de modelos disponíveis.

### Qual temperatura devo usar?

Menor é geralmente melhor para tradução:

| Temperatura | Efeito | Recomendado Para |
|-------------|--------|-----------------|
| **0.0 – 0.2** | Saída altamente determinística, consistente | Métodos de produção, benchmarks finais |
| **0.3 – 0.5** | Alguma variação, ocasionalmente mais criativo | Exploração, iteração inicial |
| **0.6+** | Alta variação, imprevisível | Não recomendado para benchmarking de MT |

A temperatura é registrada no cartão de execução, então diferentes temperaturas produzem diferentes impressões digitais — são tratadas como experimentos diferentes.

### Os dados de coaching ajudam?

Sim, significativamente — para idiomas de baixo recurso. Dados de coaching (regras gramaticais, entradas de dicionário, notas de estilo) são injetados no prompt do sistema do LLM. Para Plains Cree, métodos com coaching consistentemente superam métodos LLM brutos para idiomas polissintéticos porque LLMs de propósito geral têm exposição limitada a polissintéticos e nenhuma consciência morfológica. Mesmo OMT-1600, que foi especificamente treinado para CRK, usa tokenização BPE padrão que não pode representar morfologia polissintética estruturalmente. Os dados de coaching fornecem o contexto linguístico que o modelo não possui.

Para idiomas de alto recurso (Francês, Espanhol), coaching tem menos impacto porque o modelo já tem conhecimento baseline forte.

Veja [Dados de Coaching](https://champollion.dev/docs/concepts/coaching-data) para a especificação completa.

---

## FST & Validação Morfológica

### E se não houver FST para meu idioma?

Muitos idiomas não têm um transdutor de estados finitos. Tudo bem — o harness funciona sem um. A pontuação composta usa pesos do Perfil B (veja [Especificação de Pontuação §4.3](/docs/network/specifications/scoring#43-weight-tables)) que deslocam peso para métricas semânticas e de superfície. Aceitação FST é marcada como `null` no cartão de execução.

Os principais registros para FSTs existentes:

| Registro | Cobertura | URL |
|----------|----------|-----|
| **GiellaLT** | Mais de 100 idiomas — os idiomas Sami, Cree, Inuktitut e muitos outros idiomas urálicos e minoritários | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Cree das Planícies, Tsuut'ina, Odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | ~60 pares de idiomas, em sua maioria europeus | [apertium.org](https://apertium.org/) |
| **UniMorph** | Paradigmas morfológicos para mais de 150 idiomas | [unimorph.github.io](https://unimorph.github.io/) |

### Posso construir um FST?

Sim, mas não é trivial. Um FST codifica as regras morfológicas de um idioma — todas as formas de palavras válidas. Construir um requer conhecimento linguístico profundo do idioma. Se você tiver acesso a uma gramática morfológica (ex., de um departamento de linguística), ela pode ser compilada em um FST usando ferramentas como [HFST](https://hfst.github.io/) ou [Foma](https://fomafst.github.io/).

### Como o gating FST funciona na prática?

O pipeline com gating FST funciona assim:

1. LLM gera uma tradução
2. Cada palavra na saída é verificada contra o FST
3. Palavras que o FST rejeita são sinalizadas como morfologicamente inválidas
4. O método pode tentar novamente com feedback ("a palavra X não é válida, tente novamente")
5. Após tentativas, palavras inválidas restantes são registradas

A taxa de aceitação FST mede quantas palavras passam na validação. Veja o [Tutorial de Pipeline com Gating FST](/docs/network/tutorials/fst-gated-pipeline) para um exemplo completo trabalhado.

---

## Dados & Conjuntos de Dados

### Posso contribuir um conjunto de dados para um novo idioma?

Sim. Requisitos mínimos de [Especificação de Benchmark §11](/docs/network/specifications/benchmark#11-extending-to-new-languages):

- **50 entradas de padrão ouro** (fonte + tradução de referência verificada)
- **30 entradas de desenvolvimento** (podem sobrepor com padrão ouro para corpora pequenos)
- **Consentimento comunitário** (para idiomas indígenas, autorização explícita de um órgão de governança)
- **Documentação de proveniência** (de onde os dados vieram, qual licença se aplica)

Novos conjuntos de dados abrem novas faixas de leaderboard automaticamente. Veja [Para Comunidades de Idiomas](/docs/network/community/for-language-communities) para o guia do contribuidor.

### Em qual formato meu conjunto de dados deve estar?

JSON com os nomes de campo canônicos:

```json
{
  "name": "my-language-dev-v1",
  "language_pair": "en-xxx",
  "segment": "development",
  "version": "1.0",
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "[translation in target language]",
      "difficulty": 1,
      "domain": "general"
    }
  ]
}
```

Veja [Conjuntos de Dados](/docs/network/leaderboard/datasets) para o schema completo e definições de tier de dificuldade.

---

## Soberania & Propriedade

### Quem é o proprietário de um método construído para um idioma indígena?

Para idiomas indígenas, métodos que atingem tier Implantável (composta ≥ 0.70) E passam na validação comunitária disparam o processo de [transferência de propriedade](/docs/network/sovereignty/ownership-transfer). A propriedade do código é transferida do pesquisador para a organização de governança da comunidade de idiomas.

O pesquisador retém:
- Direitos de publicação (artigos acadêmicos sobre o método)
- Crédito no leaderboard
- O direito de aplicar as mesmas *técnicas* a outros idiomas

A organização de governança ganha:
- Propriedade total do código do método e dados de coaching
- Controle sobre implantação (quando, onde, como) — e tudo que uma implantação gera. Champollion é não-comercial e não toma nenhuma parte

### Posso usar champollion para idiomas não-indígenas sem nenhuma preocupação de soberania?

Sim. Para idiomas padrão (Francês, Japonês, Espanhol, etc.), não há considerações de soberania. Use champollion normalmente — traduza, sincronize, publique como desejar. O framework de soberania se aplica especificamente a idiomas indígenas e governados por comunidades onde princípios de governança de dados (princípios indígenas de soberania de dados, CARE, Te Mana Raraunga) requerem consideração especial.

---

## Veja Também

- **[Como Funciona](https://champollion.dev/how-it-works)** — o explicador completo da solução
- **[Especificação de Pontuação](/docs/network/specifications/scoring)** — a SSOT para toda lógica de pontuação (métricas, pesos, tiers)
- **[Especificação de Benchmark](/docs/network/specifications/benchmark)** — protocolo de avaliação, formato de corpus, soberania
- **[Submeta um Método](/docs/network/getting-started/submit-a-method)** — guia de início rápido passo a passo
- **[Regras do Leaderboard](/docs/network/leaderboard/rules)** — critérios de submissão
- **[Gestão de Dados](/docs/network/sovereignty/data-sovereignty)** — corpora permanecem com seus gestores; toda licença respeitada
