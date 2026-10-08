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

O destaque, e o único número que classifica uma execução, é o **chrF++ de corpus** com seu intervalo de confiança de 95%. Ao lado dele, o harness relata as outras métricas padrão — **BLEU, spBLEU e TER**, e **COMET** quando instalado — cada uma isoladamente, nunca combinadas. Todo o restante é um **diagnóstico**: relatado separadamente para explicar uma pontuação, nunca fazendo parte dela. A tabela abaixo cobre o chrF++ e os principais diagnósticos; três são agnósticos em relação ao idioma e dois dependem atualmente de plugins específicos para CRK, que serão generalizados à medida que expandirmos para mais idiomas. Os corpora de referência executáveis hoje são conjuntos públicos com licença aberta — Global Voices, Tatoeba, TICO-19, IN22, SMOL e mais (consulte [Conjuntos de dados](/docs/network/leaderboard/datasets)) — e o leaderboard está aberto para envios em todos os pares registrados. Cree das planícies é simplesmente onde as duas métricas específicas de idioma (baseadas em FST) foram implementadas pela primeira vez.

| Métrica | Escala | O que mede | Status |
|--------|-------|-----------------|--------|
| **chrF++** (destaque) | 0–100 | Sobreposição de n-gramas de caracteres entre as traduções previstas e de referência, calculada sobre todo o corpus com o sacreBLEU (sua assinatura é registrada). A métrica de superfície padrão para idiomas morfologicamente ricos. | ✅ Todos os idiomas |
| **Correspondência exata** (diagnóstico) | 0.0–1.0 | Proporção de entradas em que a previsão corresponde exatamente à referência após a normalização. | ✅ Todos os idiomas |
| **Aceitação por FST** (diagnóstico) | 0.0–1.0 | Proporção de palavras de saída aceitas por um transdutor de estados finitos (analisador morfológico). Calculada apenas quando um binário FST é fornecido. | ✅ Todos os idiomas com FST |
| **Correspondência equivalente** (diagnóstico) | 0.0–1.0 | Fração de entradas que correspondem à referência ou a uma variante aceitável — considerando a ordem das palavras, convenções ortográficas e diferenças dialetais. | ⚡ CRK (em generalização) |
| **Pontuação semântica** (diagnóstico) | 0.0–1.0 | Pontuação de preservação de sentido — quão bem a tradução captura o significado pretendido, independentemente da forma de superfície? | ⚡ CRK (em generalização) |

Diagnósticos adicionais — **precisão morfológica**, **troca de código (code-switching)**, **aderência terminológica**, **alucinação** e **estilo de escrita** — e o status de implementação de cada métrica estão na [Especificação de pontuação §2](/docs/network/specifications/scoring#2-metric-inventory), o inventário completo de métricas.

### Como uma execução é pontuada?

Toda nova execução é pontuada de acordo com o padrão de pontuação `standard/1`, da mesma forma que a área relata a avaliação de tradução automática (WMT, FLORES-200, AmericasNLP):

- **Destaque:** chrF++ de corpus, registrado com seu IC bootstrap de 95% e assinatura sacreBLEU — por exemplo, `chrF++ 47.5 [45.9, 49.0]`.
- **Ao lado:** BLEU, spBLEU, TER e COMET quando calculado. Nunca combinados.
- **Diagnósticos:** correspondência exata, aceitação por FST, precisão morfológica, troca de código, alucinação, terminologia, estilo de escrita. Relatados separadamente; eles nunca classificam uma execução.
- **Ressalvas de pontuação** são exibidas logo ao lado do destaque quando o harness detecta um padrão que torna o número enganoso.

Se uma execução é **melhor** do que outra é algo decidido por um teste pareado de significância no chrF++ (`mt-eval compare --significance`), e não pela simples comparação de dois números. Regras completas: [Como as execuções são pontuadas](/docs/network/specifications/scoring#how-runs-are-scored) e a [Especificação de significância](/docs/network/specifications/significance).

### O que aconteceu com a pontuação composta e os níveis de qualidade?

Ambos foram **descontinuados** para novas execuções. O valor composto era uma média ponderada de chrF++, correspondência exata, aceitação por FST e outros sinais, e os níveis (Linha de base → Fluente) eram rótulos derivados dele. Várias de suas entradas nunca comparam a saída com a fonte ou a referência, de modo que um sistema poderia obter a maior parte da pontuação sem traduzir: um modelo não treinado de inglês→sámi setentrional que repetisse uma única frase válida para cada entrada obteve 0,6244 — rotulado como "funcional" — com chrF++ de 5,5. Os novos cartões de execução publicam `composite: null` e `quality_tier: null`.

Cartões publicados antes do padrão mantêm seu valor composto armazenado e continuam verificáveis; onde quer que um seja exibido, ele é rotulado como **composto legado (descontinuado)**. Veja [por que o composto foi descontinuado](/docs/network/specifications/scoring#why-the-composite-was-retired).

Uma pontuação automática não é um veredito de qualidade. Apenas a avaliação humana feita por falantes do idioma atesta a qualidade.

### O que são níveis de verificação?

Os **níveis de verificação** descrevem *quem validou o resultado*, não o quão bom ele é:

| Nível de verificação | O que significa |
|-------------------|---------------|
| **Autoavaliado (Self-benchmarked)** | O autor do envio executou o harness por conta própria. As pontuações são plausíveis, mas não verificadas. |
| **Verificado pelo Champollion (Champollion Verified)** | Um mantenedor reproduziu o resultado usando a configuração de método enviada. |
| **Validado pela comunidade (Community Validated)** | Falantes bilíngues do idioma de destino, qualificados segundo o protocolo da própria comunidade, avaliaram uma amostra estratificada da saída (≥30 entradas, ≥2 revisores) e ≥70% atenderam aos critérios da comunidade. Concedido apenas por meio de testes realizados pela própria comunidade; o rebaixamento por auditoria pontual é simétrico e igualmente público. |

Uma execução pode ter um chrF++ alto e ainda assim ser apenas "Autoavaliada" — o que significa que ninguém confirmou a pontuação de forma independente e nenhum falante julgou a saída.

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

1. **Autoavaliado (Self-benchmarked):** Todo envio começa aqui, e hoje todas as linhas na tabela ainda estão aqui.
2. **Verificado pelo Champollion (Champollion Verified):** O projeto pontua novamente as saídas enviadas por você em relação ao corpus de referência fixado por hash sha com a métrica do harness. Quando sua pontuação é reproduzida, a execução é promovida para Verificado pelo Champollion — o nível que uma classificação de concurso usa por padrão e o único nível elegível para premiação; a tabela pública também lista linhas autoavaliadas, rotuladas como tal. Se não for reproduzida, ou se uma referência armazenada tiver sido alterada, a execução é desclassificada. A repontuação é um processo em lote manual feito por um mantenedor: nada o executa no momento do envio e nada o agenda automaticamente.
3. **Validado pela comunidade (Community Validated):** Falantes bilíngues do idioma de destino, qualificados segundo o próprio protocolo da comunidade, revisam uma amostra estratificada da saída do seu método — pelo menos 30 entradas, pelo menos 2 revisores — e pelo menos 70% devem atender aos critérios da comunidade. O nível é concedido apenas por testes que a comunidade executa por conta própria, a seu critério, e pode ser revogado da mesma forma: uma auditoria pontual reprovada rebaixa o método de maneira igualmente pública. Isso não pode ser automatizado — requer engajamento comunitário.

### Por que vocês não executam novamente o método de todos para verificá-lo?

Porque não temos recursos para isso e não precisamos. A repontuação das saídas enviadas de *todos* é gratuita (isso detecta pontuações digitadas manualmente ou editadas). Executar um modelo novamente de fato consome computação real, portanto isso ocorreria em uma **amostra** escolhida por **auditoria ponderada por reputação** — a política de amostragem foi construída e testada, mas o executor que ela controlaria ainda não, de modo que nenhuma reexecução amostrada foi disparada até o momento e uma execução selecionada é registrada como *L2-pending*. Sob essa política, uma execução é sempre selecionada se envolver alto risco (inaugurar a primeira ponte para uma família inteira de idiomas) ou for anômala (um salto bom demais para ser verdade em relação ao melhor resultado anterior), e de colaboradores comprovados ela passa por verificações pontuais raras. A reputação é conquistada apenas ao passar por essas auditorias (ou por um colaborador independente corroborando seu resultado) — nunca por volume —, portanto identidades descartáveis recém-criadas não ganham nada. Uma única falsificação identificada zera a reputação de um colaborador, reaudita todo o seu histórico verificado e é registrada publicamente, como uma retratação. Nós **não** afirmamos que sua execução "passou pelo harness" — para computação auto-hospedada isso não é verificável no servidor —, de modo que a validade repousa em *reprodutibilidade + reputação em jogo + corroboração*, não em atestação. Consulte as [Regras de avaliação de MT](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) para ver o modelo completo.

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

Muitos idiomas não possuem um transdutor de estados finitos. Não tem problema — o harness funciona sem ele. O destaque é o chrF++ de qualquer forma, portanto execuções com e sem FST são pontuadas da mesma maneira; a aceitação por FST é um diagnóstico e é marcada como `null` no cartão de execução quando nenhum FST é utilizado.

Os principais registros para FSTs existentes:

| Registro | Cobertura | URL |
|----------|----------|-----|
| **GiellaLT** | Mais de 100 idiomas — os idiomas sámi, cree, inuktitut e muitos outros idiomas urálicos e minoritários | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Cree das planícies, tsuut'ina, odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | ~60 pares de idiomas, a maioria europeus | [apertium.org](https://apertium.org/) |
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

Para idiomas indígenas, um método que atinge os requisitos de um prêmio — seu limiar automatizado e a validação comunitária por falantes — aciona o processo de [transferência de propriedade](/docs/network/sovereignty/ownership-transfer) sob o modelo padrão. A titularidade do código é transferida do pesquisador para a organização de governança da comunidade do idioma.

O pesquisador retém:
- Direitos de publicação (artigos acadêmicos sobre o método)
- Crédito no leaderboard
- O direito de aplicar as mesmas *técnicas* a outros idiomas

A organização de governança ganha:
- Propriedade total do código do método e dados de coaching
- Controle sobre implantação (quando, onde, como) — e tudo que uma implantação gera. Champollion é não-comercial e não toma nenhuma parte

### Posso usar champollion para idiomas não-indígenas sem nenhuma preocupação de soberania?

Sim. Para idiomas padrão (francês, japonês, espanhol etc.), não há considerações de soberania. Use o champollion normalmente — traduza, sincronize e publique como desejar. O framework de soberania aplica-se especificamente a idiomas indígenas e geridos pela comunidade, nos quais princípios de governança de dados — posse e controle comunitário dos dados linguísticos, CARE, Te Mana Raraunga — exigem consideração especial.

---

## Veja Também

- **[Como Funciona](https://champollion.dev/how-it-works)** — o explicador completo da solução
- **[Especificação de Pontuação](/docs/network/specifications/scoring)** — a SSOT para toda lógica de pontuação (métricas, pesos, tiers)
- **[Especificação de Benchmark](/docs/network/specifications/benchmark)** — protocolo de avaliação, formato de corpus, soberania
- **[Submeta um Método](/docs/network/getting-started/submit-a-method)** — guia de início rápido passo a passo
- **[Regras do Leaderboard](/docs/network/leaderboard/rules)** — critérios de submissão
- **[Gestão de Dados](/docs/network/sovereignty/data-sovereignty)** — corpora permanecem com seus gestores; toda licença respeitada
