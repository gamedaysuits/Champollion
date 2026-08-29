---
sidebar_position: 4
title: "Idiomas Suportados"
related:
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Browse the same coverage on the map"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "Every language as a collectible stat card"
  - label: "Language Card Specification"
    to: /docs/reference/language-card-spec
    kind: reference
  - label: "Endonym"
    to: /glossary#term-endonym
    kind: glossary
    note: "Why we write languages in their own names"
---

# Idiomas Suportados

champollion vem com **Language Cards** — arquivos de configuração estruturados para 50 idiomas. Cada card contém presets de registro, metadados do sistema de formalidade, flags de suporte a métodos, regras de tipografia e informações de script. Qualquer idioma que seu LLM conheça pode ser adicionado com uma única linha de configuração — estes são os que possuem registros curados e prontos para produção.

---

## Métodos de Tradução

Cada idioma pode usar um ou mais destes métodos de tradução:

| Ícone | Método | Como Funciona | Custo |
|------|--------|-------------|------|
| 🟢 | **Google Translate** | Base de tradução automática neural. 194 idiomas. Apenas strings de chave-valor — não consegue traduzir conteúdo Markdown com segurança. | ~$20/1M de caracteres |
| 🔵 | **LLM (OpenRouter)** | Qualquer idioma que o modelo conheça. Prompts direcionados por registro. Lida com chave-valor + conteúdo Markdown. | Varia por modelo |
| 🟣 | **LLM-Coached** | LLM + dicionários gramaticais + dados de orientação injetados nos prompts. Melhor para idiomas morfologicamente complexos. | Varia por modelo |
| 🟠 | **API (Plugin)** | Pipelines de tradução hospedados pela comunidade e servidos via HTTP. [Aspirante à soberania](/docs/network/community/low-resource-languages). | Varia por provedor |

Configure `GOOGLE_TRANSLATE_API_KEY` para Google Translate, ou `OPENROUTER_API_KEY` para métodos LLM. Veja [Métodos de Tradução](/docs/guides/translation-methods) para detalhes completos.

---

## Idiomas Prioritários

Estas são as locales mais comumente solicitadas para aplicações web e mobile, listadas na ordem recomendada de acessibilidade-primeiro do champollion.

| Bandeira | Idioma | Código | Google | LLM | Coached | Script | Notas |
|----------|--------|--------|:------:|:---:|:-------:|--------|-------|
| 🇸🇦 | Árabe | `ar` | ✅ | ✅ | ✅ | — | RTL. Árabe Padrão Moderno (فصحى). |
| 🇵🇭 | Filipino (Taglish) | `tl` / `fil` | ✅ | ✅ | ✅ | — | Use `fil` em configs do Docusaurus. champollion resolve ambos. |
| 🇫🇷 | Francês | `fr` | ✅ | ✅ | ✅ | — | Forma você. Inclusivo de gênero (Connecté·e). |
| 🇪🇸 | Espanhol | `es` | ✅ | ✅ | ✅ | — | Neutro latino-americano. |
| 🇩🇪 | Alemão | `de` | ✅ | ✅ | ✅ | — | Forma Sie. Inclusivo de gênero (Benutzer:innen). |
| 🇯🇵 | Japonês | `ja` | ✅ | ✅ | ✅ | — | です/ます para corpo do texto, する para labels de UI. |
| 🇨🇳 | Chinês (Simplificado) | `zh` | ✅ | ✅ | ✅ | — | 简体中文. |
| 🇮🇹 | Italiano | `it` | ✅ | ✅ | ✅ | — | Forma Lei. |
| 🇧🇷 | Português (BR) | `pt` | ✅ | ✅ | ✅ | — | Português Brasileiro. |
| 🇰🇷 | Coreano | `ko` | ✅ | ✅ | ✅ | — | Registro polido 해요체. |

## Idiomas Principais do Mundo

| Bandeira | Idioma | Código | Google | LLM | Coached | Script | Notas |
|----------|--------|--------|:------:|:---:|:-------:|--------|-------|
| 🇧🇩 | Bengali | `bn` | ✅ | ✅ | ✅ | — | Preferência শুদ্ধ ভাষা. |
| 🇧🇬 | Búlgaro | `bg` | ✅ | ✅ | ✅ | — | |
| 🇨🇿 | Tcheco | `cs` | ✅ | ✅ | ✅ | — | Vykání (forma vy). |
| 🇩🇰 | Dinamarquês | `da` | ✅ | ✅ | ✅ | — | |
| 🇬🇷 | Grego | `el` | ✅ | ✅ | ✅ | — | Δημοτική moderna. |
| 🇮🇷 | Persa | `fa` | ✅ | ✅ | ✅ | — | RTL. |
| 🇫🇮 | Finlandês | `fi` | ✅ | ✅ | ✅ | — | Sem gênero gramatical. |
| 🇮🇱 | Hebraico | `he` | ✅ | ✅ | ✅ | — | RTL. |
| 🇮🇳 | Hindi | `hi` | ✅ | ✅ | ✅ | — | शुद्ध हिन्दी. Empréstimos mínimos do inglês. |
| 🇭🇺 | Húngaro | `hu` | ✅ | ✅ | ✅ | — | Forma Ön. |
| 🇮🇩 | Indonésio | `id` | ✅ | ✅ | ✅ | — | |
| 🇲🇾 | Malaio | `ms` | ✅ | ✅ | ✅ | — | |
| 🇳🇱 | Holandês | `nl` | ✅ | ✅ | ✅ | — | Forma U. |
| 🇳🇴 | Norueguês | `nb` | ✅ | ✅ | ✅ | — | Bokmål. |
| 🇵🇱 | Polonês | `pl` | ✅ | ✅ | ✅ | — | Forma Pan/Pani. |
| 🇵🇹 | Português (EU) | `pt-PT` | ✅ | ✅ | ✅ | — | Português Europeu. |
| 🇷🇴 | Romeno | `ro` | ✅ | ✅ | ✅ | — | |
| 🇷🇺 | Russo | `ru` | ✅ | ✅ | ✅ | — | Forma Вы. |
| 🇸🇰 | Eslovaco | `sk` | ✅ | ✅ | ✅ | — | Vykanie (forma vy). |
| 🇷🇸 | Sérvio | `sr` | ✅ | ✅ | ✅ | 🔤 Latin→Cirílico | Conversor de script determinístico. |
| 🇸🇪 | Sueco | `sv` | ✅ | ✅ | ✅ | — | |
| 🇰🇪 | Suaíli | `sw` | ✅ | ✅ | ✅ | — | |
| 🇹🇭 | Tailandês | `th` | ✅ | ✅ | ✅ | — | Partículas de polidez ครับ/ค่ะ. |
| 🇹🇷 | Turco | `tr` | ✅ | ✅ | ✅ | — | Forma Siz. |
| 🇺🇦 | Ucraniano | `uk` | ✅ | ✅ | ✅ | — | Forma Ви. |
| 🇵🇰 | Urdu | `ur` | ✅ | ✅ | ✅ | — | RTL. Forma آپ. |
| 🇻🇳 | Vietnamita | `vi` | ✅ | ✅ | ✅ | — | |
| 🇹🇼 | Chinês (Tradicional) | `zh-TW` | ✅ | ✅ | ✅ | — | 繁體中文. |
| 🇬🇪 | Georgiano | `ka` | ✅ | ✅ | — | — | ქართული. Família Kartveliana. |
| 🇳🇬 | Iorubá | `yo` | ✅ | ✅ | — | — | Èdè Yorùbá. Tonal (3 tons). |

## Variantes Regionais

| Bandeira | Idioma | Código | Google | LLM | Coached | Script | Notas |
|----------|--------|--------|:------:|:---:|:-------:|--------|-------|
| 🇲🇽 | Espanhol Mexicano | `es-MX` | ✅ | ✅ | ✅ | — | Forma tú. Registro caloroso. |
| 🇨🇦 | Francês Canadense | `fr-CA` | ✅ | ✅ | ✅ | — | Idiomas quebequenses. |

---

## Idiomas Indígenas e de Baixos Recursos

Esses idiomas não são suportados por serviços comerciais de tradução automática. O champollion fornece as ferramentas para que as comunidades linguísticas construam seus próprios métodos sob os [princípios de soberania de dados](/docs/network/community/low-resource-languages).

| | Idioma | Código | Google | LLM | Coached | Script | Status |
|---|--------|--------|:------:|:---:|:-------:|--------|--------|
| 🪶 | Plains Cree | `crk` | ❌ | ✅ | ✅ | 🔤 SRO→Silábico | 🚧 Em desenvolvimento |
| 🌄 | Quíchua | `qu` | ✅ | ✅ | — | — | Runasimi. Sufixos evidenciais. |

:::info[O Plains Cree está em desenvolvimento ativo]
O registro, a infraestrutura de orientação, o conversor de scripts e a estrutura de avaliação para o Plains Cree estão todos funcionais, mas o pipeline de tradução **ainda não foi lançado**. Estamos trabalhando com as comunidades linguísticas sob os [princípios de soberania de dados](/docs/network/community/low-resource-languages) para garantir a qualidade antes do lançamento. Veja [Apoiar um Idioma com Poucos Recursos](/docs/network/community/low-resource-languages) para ler a história completa — e como você pode contribuir.
:::

:::tip[Adicionando mais línguas de baixo recurso]
O sistema de plugin de método do champollion foi projetado para isso. Uma comunidade de linguagem pode construir um método de tradução personalizado, hospedá-lo sob seu próprio controle e servi-lo via [método API](/docs/guides/serving-a-method). O [Method Leaderboard](/leaderboard) rastreia pontuações para qualquer par de idiomas — construa um método, execute o harness e reivindique a pontuação máxima.
:::

---

## Idiomas Construídos

Conlangs são suportados via registros LLM e conversores de script opcionais. Eles usam a mesma infraestrutura que idiomas reais — o gate de qualidade, sistema de coaching e pipeline de conversão de script funcionam identicamente.

| | Idioma | Código | Google | LLM | Script | Notas |
|---|--------|--------|:------:|:---:|--------|-------|
| 🖖 | Klingon | `tlh` | ❌ | ✅ | 🔤 Romanização→pIqaD | Fonte PUA necessária. Vocabulário Marc Okrand. |
| 🧝 | Sindarin (Élfico Tolkien) | `x-elvish-s` | ❌ | ✅ | 🔤 Latin→Tengwar | Fonte PUA CSUR necessária. |
| 🏴‍☠️ | Inglês Pirata | `x-pirate` | ❌ | ✅ | — | Apenas registro. Metáforas náuticas. |
| 🦸 | Kryptoniano | `x-kryptonian` | ❌ | ✅ | 🔤 Latin→Kryptoniano | Fonte PUA necessária. |
| 🎭 | Inglês Shakespeariano | `x-shakespeare` | ❌ | ✅ | — | Apenas registro. Formas thee/thou, -eth/-est. |
| 🐸 | Fala Yoda | `x-yoda` | ❌ | ✅ | — | Apenas registro. Ordem de palavras OSV. |

Veja [Conlangs, Scripts & Ortografia](/docs/guides/conlangs-scripts-orthography) para requisitos de fonte PUA, limitações Unicode e como adicionar a sua.

---

## Presets de Idioma

O assistente `init` suporta nomes de preset para configuração rápida. Você pode misturar presets com códigos individuais.

| Preset | Expande Para |
|--------|-----------|
| `european` | fr, de, es, it, pt, nl |
| `asian` | ja, zh, ko |
| `global` | fr, es, de, ja, zh, ko, pt, ar |
| `nordic` | da, fi, nb, sv |

```bash
# Mix presets with individual codes
champollion init
# → Target languages: european, ja
# → Resolves to: fr, de, es, it, pt, nl, ja
```

---

## Adicionando Qualquer Idioma

champollion pode traduzir para **qualquer idioma que seu LLM conhece** — a tabela acima apenas lista idiomas com presets de registro integrados. Para adicionar um idioma não listado, inclua seu código BCP-47 em sua configuração:

```json
{
  "languages": {
    "sw": {},
    "am": {
      "register": "Formal Amharic. Professional register with Geʽez script."
    }
  }
}
```

O LLM traduzirá usando seu conhecimento de treinamento do idioma. Configurar um `register` lhe dá controle sobre tom, formalidade e convenções ortográficas. Veja [Configuração](/docs/getting-started/configuration) para detalhes.

---

## Language Cards {#language-cards}

Cada idioma integrado tem uma **Language Card** — um arquivo JSON unificado em `shared/language-cards/` contendo todos os metadados: registros, formalidade, suporte a métodos, regras de tipografia, classificação genealógica, desafios linguísticos e recursos de NLP.

### Arquitetura de Card Unificada

Cada card é carregado com antecedência na importação. Não há tier de referência separado — todos os dados vivem em um único arquivo por idioma. Cards são enriquecidos de fontes autoritárias:

| Fonte | Dados |
|-------|------|
| [Glottolog](https://glottolog.org) | Classificação de família, cadeia de ancestralidade, Glottocode |
| [WALS](https://wals.info) | Classificação de gênero, características tipológicas |
| [CLDR](https://cldr.unicode.org) | Script, direção, regras de plural, tipografia |
| [ISO 15924](https://unicode.org/iso15924/) | Códigos de script |

### Campos Principais do Card

| Campo | O Que Contém |
|-------|------------------|
| **`nativeName`** | Endônimo — o nome do idioma para si mesmo, em seu próprio script (ex: ქართული, Runasimi) |
| **`classification`** | Âncora genealógica: família, gênero, cadeia de ancestralidade completa do Glottolog |
| **`contactInfluences`** | Histórico de contato universal — camadas de empréstimo, superstrato, substrato |
| **Sistema de formalidade** | Distinção T-V, níveis de fala, keigo, partículas, etc. |
| **Presets de registro** | Presets de prompt LLM nomeados específicos do caráter do idioma |
| **Suporte a método** | Quais APIs de tradução suportam este idioma |
| **Orientação de gênero** | Regras de gênero gramatical e dicas de escrita inclusiva |
| **Script/direção** | Código de script ISO 15924 e RTL/LTR |
| **Regras** | Tipografia (aspas, espaçamento), capitalização, categorias de plural |
| **`glottocode`** | Identificador canônico do Glottolog para referência cruzada |
| **`dataSources`** | Rastreamento de proveniência (ex: `["glottolog-5.3", "cldr-48"]`) |

### Scaffolding de um Novo Language Card

Use o gerador para fazer scaffold de um card a partir de fontes de dados autoritárias (IANA, CLDR, Glottolog):

```bash
# Preview what would be generated
node scripts/generate-language-card.mjs sw --dry-run

# Generate a unified card
node scripts/generate-language-card.mjs sw
```

O gerador popula automaticamente metadados (códigos, script, direção, plurais, aspas, suporte a método, classificação) e marca campos de julgamento linguístico como TODO para curação humana.

### Usando Chaves de Preset

Em vez de escrever texto de registro completo, você pode usar um nome de chave de preset:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "polite"
  }
}
```

Champollion resolve a chave para o prompt de registro completo. Execute `npx champollion init` para ver presets disponíveis para cada idioma.

### Presets de Exemplo

| Idioma | Presets | Padrão |
|--------|---------|--------|
| Francês | `formal-vous`, `casual-tu` | `formal-vous` |
| Coreano | `polite-haeyo`, `formal-hapsyo`, `casual-hae` | `polite-haeyo` |
| Japonês | `polite`, `formal-keigo`, `casual` | `polite` |
| Alemão | `formal-Sie`, `casual-du` | `formal-Sie` |
| Tailandês | `neutral-professional`, `polite-male`, `polite-female` | `neutral-professional` |
| Espanhol | `neutral-professional`, `formal-usted`, `casual-tuteo` | `neutral-professional` |

Veja [Contribuindo com um Language Card](https://github.com/gamedaysuits/champollion) para a especificação completa, incluindo validação de campo e checklist de PR.

---

## Veja Também

- [Configuração](/docs/getting-started/configuration) — referência de configuração completa incluindo setup de idioma
- [Métodos de Tradução](/docs/guides/translation-methods) — como cada método funciona
- [Conversores de Script](/docs/concepts/script-converters) — pipeline de conversão de script determinístico
- [Conlangs, Scripts & Ortografia](/docs/guides/conlangs-scripts-orthography) — fontes PUA, Unicode, adicionando conlangs
- [Suporte a um Idioma de Baixos Recursos](/docs/network/community/low-resource-languages) — construindo métodos para idiomas subutilizados
