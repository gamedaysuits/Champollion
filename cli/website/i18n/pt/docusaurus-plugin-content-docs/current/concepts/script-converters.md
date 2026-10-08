---
sidebar_position: 6
title: "Conversores de Script"
---

# Conversores de Script

Conversores de script são hooks pós-tradução determinísticos e livres de LLM que convertem texto de um sistema de escrita para outro. Eles habilitam um fluxo de trabalho "traduzir uma vez, renderizar em múltiplos scripts" — você traduz para um script funcional (tipicamente Latin), depois converte para o script de exibição automaticamente.

## Por que Conversores de Script?

Alguns idiomas usam múltiplos scripts para a mesma língua falada:

- **Plains Cree**: SRO (Latin) para edição → Syllabics (ᓀᐦᐃᔭᐍᐏᐣ) para exibição
- **Serbian**: Latin para uso internacional → Cyrillic para uso doméstico
- **Klingon**: Romanização para digitação → pIqaD (  ) para exibição

Traduzir diretamente para scripts não-Latin cria problemas: LLMs alucinam caracteres, arquivos JSON ficam difíceis de controlar versão, e ferramentas de diff não conseguem comparar mudanças. Conversores de script resolvem isso mantendo traduções em um script amigável ao controle de versão e convertendo deterministicamente no momento da sincronização.

## Conversores Disponíveis

Champollion vem com cinco conversores de script integrados:

| Locale | De | Para | Tipo | Fonte Necessária? |
|--------|------|----|------|----------------|
| `crk` | SRO (Standard Roman Orthography) | Cree Syllabics | Determinístico | Não — Unicode nativo |
| `sr` | Latin | Cyrillic | Determinístico | Não — Unicode nativo |
| `tlh` | Romanização | pIqaD | Determinístico | Sim — PUA U+F8D0–F8FF |
| `x-elvish-s` | Latin | Tengwar (Mode of Beleriand) | Determinístico | Sim — PUA U+E000–E07F |
| `x-kryptonian` | Latin | Kryptonian | Cifra baseada em fonte | Sim — PUA U+E100–E119 |

### Determinístico vs. Baseado em Fonte

- **Conversores determinísticos** (Cree, Serbian, Klingon, Tengwar) realizam mapeamento real de caractere para caractere usando regras linguísticas. A saída contém caracteres Unicode reais.
- **Conversores baseados em fonte** (Kryptonian) são cifras de substituição 1:1 onde a saída são caracteres Unicode PUA que só renderizam corretamente com uma fonte específica carregada.

## Como Funcionam

Conversores de script executam **após** a tradução como uma etapa de pós-processamento. O pipeline é:

```
Source (English) → LLM Translation → Working Script → Script Converter → Display Script
```

Por exemplo, Plains Cree:
```
"Welcome" → LLM → <its translation, in SRO> → Converter → <the same text, in Syllabics>
```

O conversor mapeia grafias, não palavras: as sílabas `pâ tê ki` (um exemplo de grafia, não uma palavra) tornam-se `ᐹ ᑌ ᑭ`.

### Correspondência Gulosa da Esquerda para a Direita

Todos os conversores usam o mesmo algoritmo: em cada posição de caractere, tente a correspondência mais longa possível primeiro, depois progressivamente correspondências mais curtas. Caracteres que não correspondem a nenhum padrão (espaços, pontuação, números) passam inalterados.

Isso trata digrafos e trigrafos corretamente:
- Klingon: `tlh` → caractere pIqaD único (não `t` + `l` + `h`)
- Serbian: `nj` → `њ` (não `н` + `ј`)
- Cree: `twê` → syllabic único (não `t` + `w` + `ê`)

## Usando Conversores de Script

A conversão é uma **decisão de configuração, nunca automática** (desde a 0.3.0 — versões anteriores convertiam incondicionalmente, o que enviava texto em PUA impossível de renderizar para projetos cujas fontes esperavam transliteração latina):

- **crk e sr têm duas ortografias reais** (SRO/Silábico, Latino/Cirílico). Não há padrão: `champollion init` pergunta qual escrever, e `sync` se recusa a executar até que a configuração determine. O Champollion não escolhe o sistema de escrita de uma comunidade.
- **tlh, x-elvish-s e x-kryptonian têm a romanização como padrão** — suas escritas de exibição estão na Área de Uso Privado (PUA), impossíveis de renderizar sem uma fonte especial. Ative explicitamente se desejar.

```json title="champollion.config.json"
{
  "languages": {
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Quando o champollion sincroniza `en:crk` com `"script": "Cans"`, as traduções são produzidas em SRO (a escrita de trabalho que o gate valida) e, em seguida, convertidas para Silábico antes de gravar em `crk.json`. Com `"script": "Latn"` — ou para tlh sem nenhum `script:` — a escrita de trabalho é a entrega final e nada é convertido.

Letras que o conversor não consegue mapear (o klingon não tem `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x`, `z` — logo, "GitHub" não pode ser totalmente convertido) mantêm o **valor inteiro** na escrita de trabalho em vez de misturar sistemas de escrita, com um aviso indicando as letras. Declare suas próprias regras de transliteração com [`scriptFallback`](/docs/getting-started/configuration#script-fallback).

Para desfazer a conversão ocorrida quando ela era incondicional, execute [`champollion repair-script`](/docs/getting-started/configuration#repair-script); o `champollion integrity` falha se encontrar PUA onde a conversão estiver desativada.

### Verificando o Status do Conversor

```bash
npx champollion status
```

A saída de status mostra a decisão de escrita resolvida para cada par — o que será gravado e se há um conversor disponível, mas não habilitado.

## Requisitos de Fonte Web

Três conversores produzem caracteres Unicode de Área de Uso Privado (PUA) que requerem fontes web customizadas:

### Klingon (pIqaD)

Instale uma fonte pIqaD compatível com CSUR (ex: "pIqaD qolqoS" ou "Klingon pIqaD HaSta"):

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaD.woff2') format('woff2');
  unicode-range: U+F8D0-F8FF;
}

:lang(tlh) {
  font-family: 'pIqaD', sans-serif;
}
```

### Tengwar (Sindarin)

Instale uma fonte Tengwar compatível com CSUR (ex: "Tengwar Formal CSUR", "Tengwar Annatar"):

```css
@font-face {
  font-family: 'Tengwar';
  src: url('/fonts/tengwar-formal-csur.woff2') format('woff2');
  unicode-range: U+E000-E07F;
}

:lang(x-elvish-s) {
  font-family: 'Tengwar', serif;
}
```

### Kryptonian

Instale uma fonte Kryptonian mapeada para codepoints PUA U+E100–E119:

```css
@font-face {
  font-family: 'Kryptonian';
  src: url('/fonts/kryptonian.woff2') format('woff2');
  unicode-range: U+E100-E119;
}

:lang(x-kryptonian) {
  font-family: 'Kryptonian', sans-serif;
}
```

:::tip[Abordagem alternativa para Kryptoniano]
Como Kryptoniano é uma cifra pura de A-Z, você pode pular o conversor de script inteiramente e aplicar a fonte ao texto Latino via CSS. Isso geralmente é mais simples para implantações web — apenas sirva a fonte Kryptoniana e defina `font-family` nos elementos relevantes.
:::

## Adicionando um Conversor Customizado

Para adicionar um conversor para um novo idioma, edite `lib/scripts.js`:

1. **Crie o mapa de conversão** — um array ordenado de pares `[from, to]`, sequências mais longas primeiro
2. **Crie a função de conversão** — um scanner guloso (greedy) da esquerda para a direita (use `latinToCyrillicSr` como modelo). Onde existir um conversor mantido pela comunidade, use-o em vez de uma tabela própria: Plains Cree delega para o `cree-sro-syllabics`, o conversor que o itwêwina do ALTLab utiliza
3. **Registre-o** no objeto `SCRIPT_CONVERTERS` com o código de localidade como chave
4. **Adicione o campo `script`** à entrada de registro do idioma em `registers.js`

```javascript
// Example: adding a converter for Cherokee (chr)
const LATIN_TO_CHEROKEE_MAP = [
  ['ga', 'Ꭶ'], ['ka', 'Ꭷ'], ['ge', 'Ꭸ'], // ...
];

function latinToCherokee(text) {
  // Same greedy left-to-right pattern as other converters
}

SCRIPT_CONVERTERS['chr'] = {
  from: 'Latin',
  to: 'Cherokee Syllabary',
  type: 'deterministic',
  converter: latinToCherokee,
};
```

---

## Veja Também

- [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) — fontes PUA, Unicode, adicionando novos conversores
- [Quality Gate](/docs/concepts/quality-gate) — validação que executa antes da conversão de script
- [Supported Languages](/docs/reference/supported-languages) — quais idiomas têm conversores de script
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — SRO→Syllabics em contexto
- [Cookbook: FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline) — conversão de script em um pipeline multi-estágio
