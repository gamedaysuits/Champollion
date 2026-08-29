---
sidebar_position: 3
title: "Línguas Construídas, Sistemas de Escrita e Ortografia"
---

# Conlangs, Scripts & Ortografia

champollion tem suporte de primeira classe para linguagens construídas via registros LLM e conversores de script determinísticos. Este guia cobre como o suporte a conlangs funciona, quais fontes você precisa e como adicionar as suas.

:::tip[Por que conlangs importam]
Conlangs não são apenas novidade — elas exercitam exatamente a mesma infraestrutura usada para idiomas reais com poucos recursos. O gate de qualidade, o sistema de coaching e o pipeline de conversão de scripts funcionam de forma idêntica para Klingon e Plains Cree. Se seu pipeline de conlang funciona, seu pipeline de idioma com poucos recursos também funcionará.
:::

---

## Linguagens Construídas Suportadas

| Linguagem | Código | Conversor de Script | Fonte Necessária |
|----------|------|:----------------:|:-------------:|
| Klingon | `tlh` | ✅ Romanização → pIqaD | Fonte PUA (ex: pIqaD qolqoS) |
| Sindarin (Élfico Tolkien) | `x-elvish-s` | ✅ Latin → Tengwar | Fonte CSUR PUA |
| Kryptoniano | `x-kryptonian` | ✅ Latin → Kryptoniano | Fonte PUA |
| Pirate English | `x-pirate` | ❌ apenas registro | Nenhuma |
| Shakespearean English | `x-shakespeare` | ❌ apenas registro | Nenhuma |
| Yoda-speak | `x-yoda` | ❌ apenas registro | Nenhuma |

Códigos de conlang usam o prefixo `x-` conforme a convenção de uso privado BCP-47, exceto Klingon (`tlh`) que tem um código [ISO 639-3](https://iso639-3.sil.org/code/tlh) atribuído pela SIL International.

---

## Unicode, PUA e Requisitos de Fonte

### A Área de Uso Privado

Klingon (pIqaD), Sindarin (Tengwar) e Kryptoniano usam caracteres **Private Use Area (PUA)** do Unicode. PUA é o intervalo U+E000–U+F8FF — esses pontos de código **não têm atribuição padrão**. O [ConScript Unicode Registry (CSUR)](https://www.evertype.com/standards/csur/) mantém mapeamentos acordados pela comunidade para scripts ficcionais, mas estes não fazem parte do padrão Unicode.

O que isso significa na prática:

- Texto PUA renderiza como **caixas vazias** (□□□) sem a fonte correta carregada
- Diferentes fontes podem mapear glifos diferentes para os mesmos pontos de código PUA
- champollion NÃO agrupa fontes PUA — você deve carregá-las você mesmo
- Fontes do sistema nunca renderizarão esses caracteres

### Intervalos PUA por Script

| Script | Intervalo PUA | Referência CSUR |
|--------|-----------|---------------|
| Klingon (pIqaD) | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| Tengwar (Élfico) | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| Kryptoniano | Varia por fonte | Sem padrão CSUR |

### Carregando Fontes Web PUA

champollion inclui um comando integrado para baixar e gerenciar fontes web PUA:

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

O comando `fonts install` baixa de repositórios de código aberto verificados:

| Fonte | Script | Licença | Fonte |
|------|--------|---------|--------|
| pIqaD qolqoS | Klingon | SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | Tengwar | GNU GPL v3 (com exceção de fonte) | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *(fornecida pelo usuário)* | Kryptoniano | Varia | Nenhuma fonte PUA de código aberto disponível |

O diretório de saída é detectado automaticamente da estrutura do seu projeto (Docusaurus → `static/fonts/`, Hugo → `static/fonts/`, padrão → `public/fonts/`). Substitua com `--dir`.

Se você preferir gerenciar fontes manualmente, adicione regras `@font-face` no seu CSS:

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaDqolqoS.ttf') format('truetype');
  font-display: swap;
  unicode-range: U+F8D0-F8FF;
}

/* Apply to Klingon text elements */
[lang="tlh"], [data-script="piqad"] {
  font-family: 'pIqaD', sans-serif;
}
```

:::warning[Suporte a Unicode NÃO é garantido]
O Unicode Consortium [explicitamente recusou](https://www.unicode.org/faq/private_use.html) codificar scripts ficcionais no padrão. As atribuições de PUA são mantidas pela comunidade e podem entrar em conflito entre implementações de fontes. Sempre especifique a fonte exata que seu projeto usa e teste a renderização em diferentes navegadores.
:::

---

## Conversores de Script

### Como Funcionam

a conversão de script do champollion é um **hook pós-tradução, aplicado apenas quando a configuração solicita**:

1. O LLM traduz o texto para um **script de trabalho** (geralmente Latim ou SRO)
2. O [quality gate](/docs/concepts/quality-gate) valida a saída
3. Se a configuração `script:` do par selecionar o script de exibição, o conversor determinístico transforma o texto validado — valores com letras que o conversor não consegue mapear permanecem inteiros no script de trabalho, com um aviso gerado por chave
4. O resultado é gravado no disco

Essa abordagem em duas etapas funciona porque LLMs produzem melhor saída ao trabalhar em scripts baseados em Latin. O conversor determinístico garante saída de script correta sem depender do conhecimento de script do modelo (frequentemente não confiável).

Se a etapa 3 será executada ou não é uma decisão por projeto — consulte [Script Conversion](/docs/getting-started/configuration#script-conversion). Os scripts de exibição PUA (pIqaD, Tengwar, Kryptonian) estão desativados por padrão porque não renderizam nada sem uma fonte criada para esse fim; crk e sr não possuem nenhum padrão, porque ambas as suas ortografias são reais e a escolha pertence ao projeto.

### Todos os Cinco Conversores

champollion vem com cinco conversores de script integrados:

#### Plains Cree: SRO → Syllabics (`crk`)

Standard Roman Orthography para Canadian Aboriginal Syllabics.

```
Input:  "tawâw"
Output: "ᑕᐚᐤ"
```

Vogais longas usam macron/circunflexo: ê, î, ô, â. O conversor lida com todos os diacríticos SRO e os mapeia para os caracteres silábicos corretos. Veja [Support a Low-Resource Language](/docs/network/community/low-resource-languages) para o pipeline completo de Cree.

#### Sérvio: Latin → Cyrillic (`sr`)

Conversão determinística de Latin para Cyrillic para Sérvio.

```
Input:  "zdravo"
Output: "здраво"
```

Isso lida com o mapeamento completo do alfabeto sérvio incluindo dígrafos (lj → љ, nj → њ, dž → џ).

#### Klingon: Romanização → pIqaD (`tlh`)

Sistema de romanização de Marc Okrand para caracteres pIqaD PUA.

```
Input:  "Qapla'"    (romanized Klingon)
Output: [pIqaD PUA] (requires pIqaD font to render)
```

#### Sindarin: Latin → Tengwar (`x-elvish-s`)

Mapeamento de Tengwar modo Sindarin de Tolkien.

```
Input:  "elen síla"  (Latin Sindarin)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### Kryptoniano: Latin → Kryptoniano (`x-kryptonian`)

Mapeamento de script Kryptoniano de léxico de fã.

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### Acionando um Conversor

Defina o campo `script` com o código ISO 15924 da ortografia que você deseja que seja escrita:

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Nada é convertido sem isso. Para `crk` e `sr` o campo é **obrigatório** — ambas as suas ortografias são reais, e o `sync` se recusa a escolher uma para você. Para os locales PUA, é um opt-in em relação ao padrão de romanização. Consulte [Script Conversion](/docs/getting-started/configuration#script-conversion).

---

## Linguagens Multi-Script

Algumas linguagens reais usam múltiplos scripts ativos:

| Idioma | Scripts | Abordagem do champollion |
|----------|---------|-----------------|
| Sérvio | Latim + Cirílico | Um locale, escolha explícita: `"script": "Cyrl"` converte, `"script": "Latn"` mantém Latim |
| Plains Cree | SRO (Latim) + Silábicos | Um locale, escolha explícita: `"script": "Cans"` ou `"script": "Latn"` |
| Chinês | Simplificado + Tradicional | Códigos de locale separados (`zh` vs `zh-TW`) com registros distintos |

Para idiomas onde ambos os scripts atendem ao mesmo público (Sérvio, Plains Cree), um locale mais uma escolha explícita de `script` mantém um único pipeline de tradução. Para idiomas onde os scripts atendem a públicos diferentes (Chinês Simplificado para a China continental, Tradicional para Taiwan/HK), use códigos de locale separados.

---

## Notas de Ortografia

Registros não são apenas tom — eles carregam **instruções ortográficas** que direcionam o LLM para convenções de escrita corretas.

### Formas de Endereço Formal

Os registros integrados do champollion incluem o endereço formal culturalmente apropriado para cada linguagem:

| Linguagem | Forma Formal | Instrução de Registro |
|----------|------------|---------------------|
| Alemão | Sie | `Use Sie-form for formal address` |
| Francês | vous | `Use vous-form` |
| Russo | вы | `Professional register with вы-form` |
| Turco | siz | `Professional register with siz-form` |
| Coreano | 합쇼체 | `Formal Korean (합쇼체)` |
| Japonês | です/ます | `Polite professional register (です/ます form)` |
| Polonês | Pan/Pani | `Professional register with Pan/Pani form` |

### Escrita Inclusiva de Gênero

Cada cartão de linguagem tem um campo `gender.inclusiveGuidance` com conselhos específicos da linguagem. Isso é injetado no prompt de tradução do LLM separadamente do preset de registro, então se aplica consistentemente independentemente de qual preset de formalidade o usuário escolher:

- **Francês**: Écriture inclusive com notação de interponto (ex: "Connecté·e")
- **Alemão**: Notação de dois-pontos (ex: "Benutzer:innen")
- **Espanhol**: Reestruturação neutra em gênero preferida; notação de barra (ex: "usuario/a") como fallback

Para linguagens sem orientação específica em seu cartão (ex: Coreano, conlangs), o sistema volta para uma regra genérica: *"prefira formas neutras em gênero ou a opção mais inclusiva disponível."*

### Requisitos de Script RTL

Registros de Árabe, Hebraico, Persa e Urdu todos anotam requisitos da direita para esquerda: `Ensure text reads naturally in RTL layout contexts.`

### Substituindo Qualquer Registro

Todo registro é um valor de configuração — substitua-o para corresponder à voz do seu projeto:

```json
{
  "languages": {
    "fr": {
      "register": "Casual French. Use tu-form. Conversational blog tone. Gender-neutral when possible."
    },
    "de": {
      "register": "Informal German. Use du-form. Tech startup voice."
    }
  }
}
```

Veja [Configuration](/docs/getting-started/configuration) para a referência de configuração completa.

---

## Adicionando um Novo Conlang

### Passo a passo

1. **Escolha um código de uso privado BCP-47**: Use o prefixo `x-` (ex: `x-dothraki`, `x-valyrian`).

2. **Adicione à sua configuração**:

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **(Opcional) Adicione um conversor de script**: Se seu conlang usa um script de exibição não-Latin, adicione um conversor em `lib/scripts.js` e registre-o em `SCRIPT_CONVERTERS`.

4. **Teste**: Execute `champollion sync --dry` para visualizar traduções sem escrever arquivos.

5. **Verifique o quality gate**: O [quality gate](/docs/concepts/quality-gate) pode precisar de ajuste para seu conlang — particularmente a verificação `requireNonLatin` se seu conlang usa caracteres PUA.

:::note[A qualidade de conlangs depende do conhecimento do LLM]
O LLM só pode traduzir para um conlang que viu em dados de treinamento. Conlangs bem documentados (Klingon, Sindarin, Dothraki) funcionam bem. Conlangs obscuros ou recém-inventados podem produzir resultados inconsistentes. Use [dados de coaching](/docs/concepts/coaching-data) para melhorar a qualidade.
:::

---

## Veja Também

- [Supported Languages](/docs/reference/supported-languages) — tabela de linguagem completa com disponibilidade de método
- [Script Converters](/docs/concepts/script-converters) — detalhes técnicos do pipeline de conversão
- [Translation Methods](/docs/guides/translation-methods) — como cada método de tradução funciona
- [Configuration](/docs/getting-started/configuration) — referência de configuração incluindo configuração de linguagem e registro
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — a mesma infraestrutura aplicada a linguagens reais pouco atendidas
