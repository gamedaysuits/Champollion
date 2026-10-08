---
title: "Procedimento de Citação do Cartão de Idioma"
sidebar_label: "Citation Procedure"
---

# Procedimento de Citação em Cartões de Idioma

*Como o Champollion garante que toda afirmação em um cartão de idioma seja rastreável até uma fonte primária.*

---

## 1. O Problema

Cartões de idioma contêm afirmações factuais — contagens de falantes, status de ameaça, influências de contato, propriedades morfológicas, convenções tipográficas, suporte de método — que **devem ser verificáveis**. Atualmente:

- O campo `dataSources` é um array simples de strings (ex: `["cldr-48", "glottolog-5.3"]`)
- Não há granularidade de citação por campo
- Afirmações como "~2,8M falantes" ou "vulnerável" não têm proveniência rastreável
- Um revisor não consegue determinar qual fonte suporta qual afirmação

> [!CAUTION]
> **Uma afirmação sem fonte é uma afirmação não verificável.** Para um projeto que se posiciona como rigoroso profissionalmente, toda asserção em um cartão de idioma deve ser rastreável até uma fonte primária específica e versionada.

---

## 2. Fontes Autoritárias (Classificadas por Prioridade)

Para cada tipo de afirmação, as seguintes fontes são autoritárias. **Sempre prefira a fonte de maior prioridade disponível.**

### Classificação e Identidade

| Prioridade | Fonte | Cobre | Licença | Como Citar |
|---|---|---|---|---|
| 1 | [Glottolog](https://glottolog.org) (Max Planck) | Família, ancestralidade, glottocode | CC-BY 4.0 | `glottolog-5.x` |
| 2 | [ISO 639-3](https://iso639-3.sil.org) (SIL) | Códigos ISO, macrolínguas | Livre | `iso639-3-{date}` |
| 3 | [WALS](https://wals.info) (Max Planck) | Definições de gênero, características tipológicas | CC-BY 4.0 | `wals-2024` |
| 4 | [CLDR](https://cldr.unicode.org) (Unicode) | Códigos de locale, códigos de script, regras de plural | Unicode ToS | `cldr-{version}` |

### Demografia de Falantes e Vitalidade

| Prioridade | Fonte | Cobre | Licença | Como Citar |
|---|---|---|---|---|
| 1 | Dados de censo nacional | Contagens oficiais de falantes | Varia (geralmente público) | `census-{country}-{year}` |
| 2 | [Ethnologue](https://www.ethnologue.com) | Estimativas de falantes, EGIDS | Proprietária (assinatura) | `ethnologue-{edition}` |
| 3 | [Atlas UNESCO](http://www.unesco.org/languages-atlas/) | Status de ameaça | Livre | `unesco-atlas-{year}` |
| 4 | Artigos acadêmicos publicados | Pesquisas regionais de falantes | Licença por artigo | `{author}-{year}` |
| 5 | [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | Idiomas das Filipinas | Acadêmica | `katig-{year}` |

> [!WARNING]
> **Nunca use Wikipedia, texto gerado por IA ou conhecimento próprio como fonte primária para afirmações demográficas.** Essas são fontes secundárias/terciárias no melhor dos casos. Sempre rastreie até os dados primários.

### Suporte de Método (Cobertura de API de Tradução)

| Método | Fonte de Verificação | Como Verificar | Como Citar |
|---|---|---|---|
| Google Translate | [Lista de idiomas](https://cloud.google.com/translate/docs/languages) | Chamada de API ou página de docs | `google-translate-{date}` |
| DeepL | [Lista de idiomas](https://www.deepl.com/docs-api/translate-text/) | Chamada de API | `deepl-api-{date}` |
| Microsoft Translator | [Lista de idiomas](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support) | Página de docs | `ms-translator-{date}` |
| LibreTranslate | [Lista de idiomas](https://libretranslate.com/languages) | Chamada de API | `libretranslate-{date}` |
| NLLB | [FLORES README](https://github.com/openlanguagedata/flores) | README + model card | `nllb-200-{date}` |
| LLM | Sempre `true` | N/A (qualidade varia) | `llm-assumed` |

### DLS (Suporte Digital de Idioma)

| Prioridade | Fonte | Cobre | Como Citar |
|---|---|---|---|
| 1 | [Simons et al. 2022](https://aclanthology.org/2022.coling-1.379/) | Pontuações DLS (143 ferramentas originais) | `simons-2022` |
| 2 | Ethnologue 27ª+ ed. | Pontuações DLS (211 ferramentas expandidas) | `ethnologue-{edition}-dls` |

### Tipografia, Plurais, Scripts

| Prioridade | Fonte | Cobre | Como Citar |
|---|---|---|---|
| 1 | [CLDR](https://cldr.unicode.org) | Regras de plural, aspas, formatação de números | `cldr-{version}` |
| 2 | [Unicode CSUR](https://unicode.org/iso15924/) | Códigos de script | `iso15924-{date}` |
| 3 | Gramáticas publicadas | Regras específicas do idioma | `{author}-{year}` |

### Influências de Contato

| Prioridade | Fonte | Cobre | Como Citar |
|---|---|---|---|
| 1 | Artigos publicados de linguística histórica | Estudos de empréstimos, história de contato | `{author}-{year}` |
| 2 | Gramáticas de referência | Descrições de influência estrutural | `{grammar-title}-{year}` |
| 3 | [WALS](https://wals.info) | Comparações tipológicas | `wals-{feature}-{year}` |

> [!IMPORTANT]
> **Afirmações de influência de contato são as mais difíceis de fundamentar.** Afirmações como "superstrato espanhol, profundo, 1571–1898" requerem expertise em linguística histórica. Se uma fonte publicada não puder ser encontrada, marque a afirmação com `"citation_needed": true` em vez de adivinhar.

---

## 3. Procedimento de Citação (Passo a Passo)

### Ao Criar um Novo Cartão de Idioma

1. **Comece com campos preenchidos automaticamente:**
   - Execute `node scripts/build-language-tree.mjs --enrich` → preenche `classification` do Glottolog
   - Registre `"glottolog-{version}"` em `dataSources`

2. **Adicione dados CLDR:**
   - Procure regras de plural, aspas, código de script no CLDR
   - Registre `"cldr-{version}"` em `dataSources`

3. **Pesquise demografia de falantes:**
   - Verifique dados de censo nacional PRIMEIRO
   - Referência cruzada com Ethnologue (se disponível)
   - Referência cruzada com Atlas UNESCO
   - Registre TODAS as fontes consultadas em `dataSources`

4. **Verifique suporte de método:**
   - Verifique a lista de idiomas de CADA API (não memória, não suposições)
   - Registre data de verificação

5. **Pesquise influências de contato:**
   - Encontre artigos publicados de linguística histórica
   - Documente período, tipo, profundidade com citações
   - Se nenhuma fonte publicada existir, adicione `"citation_needed": true` à entrada de influência

6. **Pesquise vitalidade:**
   - Verifique Ethnologue para EGIDS
   - Verifique Atlas UNESCO para status de ameaça
   - Anote qualquer discrepância entre fontes

7. **Preencha `dataSources`:**
   - Liste TODA fonte consultada (não apenas as que forneceram dados)
   - Use o formato de citação das tabelas acima

### Ao Atualizar um Cartão Existente

1. **Nunca altere uma afirmação factual sem atualizar `dataSources`**
2. **Se você atualizar uma contagem de falantes**, remova a fonte antiga e adicione a nova
3. **Se você adicionar suporte de método**, verifique contra a API e registre a data
4. **Coloque data em todas as verificações de suporte de método** — a cobertura de API muda frequentemente

---

## 4. Melhoria de Schema Proposta: Citações por Campo

### Schema Atual (`dataSources` Simples)

```json
"dataSources": ["cldr-48", "glottolog-5.3"]
```

**Problema:** Quais campos vieram do CLDR? Quais do Glottolog? Quais não têm citação?

### Melhoria Proposta: `dataSources` Estruturado

```json
"dataSources": {
  "classification": ["glottolog-5.3"],
  "vitality.unescoStatus": ["unesco-atlas-2024"],
  "vitality.egids": ["ethnologue-27"],
  "vitality.speakerCount": ["census-ph-2020", "ethnologue-27"],
  "rules.plurals": ["cldr-48"],
  "rules.typography": ["cldr-48"],
  "contactInfluences": ["blust-2013", "llamzon-1969"],
  "methodSupport.googleTranslate": ["google-translate-2024-07"],
  "methodSupport.nllb": ["nllb-200-2024-03"],
  "dls": ["simons-2022", "ethnologue-27-dls"],
  "pipelineReadiness": ["manual-assessment-2025-06"]
}
```

### Caminho de Migração

Esta é uma mudança **compatível com versões anteriores**:
1. Cartões existentes mantêm o array simples (ainda válido)
2. Novos cartões usam o formato estruturado
3. Validação de schema aceita ambos os formatos
4. Migre cartões existentes incrementalmente conforme forem revisados

> [!TIP]
> **Valide com um script.** Adicione um script `validate-citations.mjs` que:
> - Verifique se todo cartão tem pelo menos fontes `classification` e `vitality`
> - Sinalize cartões com arrays `dataSources` simples para atualização
> - Avise sobre entradas `methodSupport` sem verificação com data

---

## 5. Checklist de Qualidade

Antes de fazer merge de qualquer alteração em cartão de idioma, verifique:

- [ ] Toda contagem de falantes tem uma fonte (censo ou Ethnologue, não Wikipedia)
- [ ] Todo status UNESCO/EGIDS tem uma fonte
- [ ] Todo sinalizador de suporte de método foi verificado contra a API real (não assumido)
- [ ] Toda influência de contato tem uma fonte acadêmica publicada OU está marcada `citation_needed`
- [ ] Classificação foi preenchida automaticamente do Glottolog (não construída manualmente)
- [ ] `dataSources` lista TODAS as fontes consultadas
- [ ] Nenhuma afirmação depende unicamente de conhecimento gerado por IA
- [ ] `humanReviewed` está definido para o identificador do revisor e data se um falante nativo revisou

---

## 6. Campo `humanReviewed`

O schema do cartão de idioma inclui um campo `humanReviewed` que está atualmente `null` em todos os cartões. Este campo deve ser preenchido quando um falante nativo ou linguista qualificado revisa o cartão:

```json
"humanReviewed": {
  "reviewer": "Prof. Kenneth Jamandre",
  "affiliation": "University of the Philippines",
  "date": "2026-06-08",
  "scope": "full",
  "notes": "Verified speaker count, vitality assessment, and contact influences."
}
```

> [!IMPORTANT]
> **Revisão comunitária é o padrão ouro.** Dados automatizados e artigos acadêmicos fornecem a base, mas a revisão de um falante nativo é a validação final. Isso é especialmente crítico para:
> - Afirmações de influência de contato (membros da comunidade sabem quais palavras emprestadas são realmente usadas)
> - Avaliações de vitalidade (membros da comunidade sabem se crianças estão falando o idioma)
> - Sistemas de formalidade (descrições acadêmicas podem perder padrões de uso cotidiano)

---

## 7. Referências para Este Procedimento

1. Glottolog: https://glottolog.org — CC-BY 4.0
2. ISO 639-3: https://iso639-3.sil.org — Livre
3. WALS: https://wals.info — CC-BY 4.0
4. CLDR: https://cldr.unicode.org — Termos de Uso Unicode
5. Ethnologue: https://www.ethnologue.com — Proprietária (assinatura)
6. Atlas UNESCO: http://www.unesco.org/languages-atlas/ — Livre
7. Simons et al. (2022): https://aclanthology.org/2022.coling-1.379/
8. Especificação de Cartão de Idioma Champollion: `cli/website/docs/reference/language-card-spec.md`
