---
sidebar_position: 7
title: "Comparação"
---

# Como o Champollion se Compara

champollion ocupa uma categoria diferente da maioria das ferramentas de localização. Aqui está uma comparação honesta.

## O Cenário

A maioria das ferramentas de localização se enquadra em uma de três categorias:

| Categoria | Exemplos | Modelo |
|----------|----------|-------|
| **Plataformas TMS em Nuvem** | Crowdin, Phrase, Locize, Tolgee | Dashboard SaaS + tradutores humanos + assinatura mensal |
| **Ferramentas de Extração de Chaves** | i18next-scanner, FormatJS CLI | Verificar código-fonte em busca de chamadas de função de tradução |
| **Mecanismos de Tradução CLI** | **champollion** | Executar no seu projeto, traduzir arquivos diretamente, sem conta em nuvem |

Champollion é um **mecanismo de tradução CLI** — ele traduz seus arquivos de localização diretamente usando backends configuráveis (LLMs, Google Translate, plugins personalizados). Sem dashboard em nuvem, sem fluxo de trabalho de tradutor humano, sem taxa mensal.

---

## Comparação de Recursos

| Funcionalidade | champollion | Crowdin | Phrase | Locize |
|---------|:------------:|:-------:|:------:|:------:|
| **Executa localmente (sem conta na nuvem)** | ✅ | ❌ | ❌ | ❌ |
| **Dependências mínimas** | ✅ | ❌ | ❌ | ❌ |
| **Configuração de método por par** | ✅ | ❌ | ❌ | ❌ |
| **Registros de idioma personalizados** | ✅ | ❌ | ❌ | ❌ |
| **Sensível ao conteúdo (protege blocos de código)** | ✅ | ❌ | ❌ | ❌ |
| **Conversão de conlangs e scripts** | ✅ | ❌ | ❌ | ❌ |
| **Arquitetura de plugins** | ✅ | ❌ | ❌ | ❌ |
| **Tradução de Markdown / conteúdo** | ✅ | ✅ | ✅ | ❌ |
| **Memória de Tradução** | ✅ | ✅ | ✅ | ✅ |
| **Exportação/importação de XLIFF** | ✅ | ✅ | ✅ | ❌ |
| **Validação de plural ICU** | ✅ | ✅ | ✅ | ❌ |
| **Aplicação de terminologia** | ✅ | ✅ | ✅ | ❌ |
| **Fluxo de trabalho para tradutores humanos** | Baseado em XLIFF | ✅ | ✅ | ✅ |
| **Edição em contexto (visual)** | ❌ | ✅ | ✅ | ✅ |
| **Colaboração em equipe** | ❌ | ✅ | ✅ | ✅ |
| **Suporte a formatos de arquivo** | JSON, TOML, YAML, MD, XLIFF | 50+ | 40+ | JSON |
| **Preço** | Gratuito para uso não comercial (pague seu LLM) | A partir de $0/mês | A partir de $0/mês | A partir de $0/mês |

---

## Quando Usar o Champollion

**Champollion é uma boa opção quando:**

- Você quer tradução automática integrada ao seu pipeline de build — não um fluxo de trabalho separado
- Você precisa de controle de método por idioma (LLM para alguns, Google Translate para outros, plugins personalizados para o resto)
- Você está traduzindo para idiomas sem cobertura de API (indígenas, em risco de extinção, construídos)
- Você quer saída de script determinística (Cree Syllabics, Klingon pIqaD, Tengwar)
- Você quer zero vendor lock-in e zero dependências de nuvem
- Você é um desenvolvedor solo ou pequena equipe que não precisa de um dashboard TMS completo
- Você quer transferência baseada em XLIFF para tradutores profissionais sem assinatura em nuvem

**Um TMS em nuvem é uma opção melhor quando:**

- Você tem tradutores humanos profissionais revisando cada string (o fluxo de trabalho XLIFF do champollion é mais simples que um TMS completo)
- Você precisa de memória de tradução e gerenciamento de glossário entre projetos
- Você precisa de edição visual em contexto (visualizar traduções dentro da sua UI)
- Você tem uma equipe grande com necessidades de controle de acesso baseado em função
- Você precisa de suporte a 50+ formatos de arquivo

---

## O Que o Champollion Faz Que Ninguém Mais Faz

### 1. Registros Personalizados

Cada par de idiomas recebe instruções de tom culturalmente apropriadas para o LLM:

```json
{
  "de": {
    "register": "Standard professional register. Use Sie-form for formal address."
  },
  "tl": {
    "register": "Educated Manila Taglish. Use Tagalog as the primary language but keep technical terms in English."
  },
  "tlh": {
    "register": "Warrior's honor. OVS grammar. Use Marc Okrand vocabulary."
  }
}
```

Nenhuma outra ferramenta vem com 47 registros de linguagem pré-configurados, ou permite que você defina personalizados por projeto.

### 2. Conversores de Script Determinísticos

Champollion vem com cinco conversores de script integrados que funcionam como hooks pós-tradução — sem necessidade de LLM:

| Localidade | Conversão | Exemplo |
|--------|-----------|---------|
| `crk` | SRO → Cree Syllabics | `nêhiyawêwin` → `ᓀᐦᐃᔭᐍᐏᐣ` |
| `sr` | Latin → Cyrillic | `Beograd` → `Београд` |
| `tlh` | Romanization → pIqaD | `tlhIngan Hol` → (pIqaD glyphs) |
| `x-elvish-s` | Latin → Tengwar | Sindarin → Tengwar (Mode of Beleriand) |
| `x-kryptonian` | Latin → Kryptonian | Cipher-substitution (requires font) |

Estes são conversores de tabela de consulta pura — determinísticos, auditáveis, zero risco de alucinação de LLM.

### 3. Proteção Consciente de Conteúdo

Ao traduzir Markdown ou conteúdo rico, Champollion protege:

- Blocos de código cercados (` ``` `)
- Código inline (`` ` ` ``)
- Shortcodes Hugo (`{{</* */>}}`, `{{%/* */%}}`)
- Variáveis de interpolação (`{{ .Count }}`, `{name}`, `{{t('key')}}`)
- Blocos HTML brutos

Estes são substituídos por tokens sentinela Unicode antes da tradução e restaurados depois. O LLM nunca vê seu código, seus shortcodes ou suas variáveis.

### 4. Plugins de Método Orientado

Para idiomas sem cobertura de API, você pode criar um método de tradução orientado:

1. Escreva dados de orientação linguística (regras de gramática, vocabulário, exemplos)
2. Empacote como um plugin
3. Compare com traduções de referência usando o [harness de avaliação](https://github.com/gamedaysuits/Champollion)
4. Instale no seu projeto com `champollion plugin install`

É assim que champollion lida com Plains Cree — e como você pode lidar com qualquer idioma, incluindo aqueles que ainda não existem.

---

## A Conclusão

Champollion não é um substituto para Crowdin. É uma ferramenta diferente para um fluxo de trabalho diferente. Se você precisa de tradutores humanos, use um TMS. Se você precisa de um CLI que traduz seus arquivos com um comando e oferece controle por idioma sobre métodos, modelos e registros — use champollion.
