---
sidebar_position: 3
title: "Quality Gate"
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# Gate ng Kalidad

Dumaraan ang bawat salin sa isang deterministic validation gate bago ito isulat sa disk. Nahuhuli ng quality gate ang karaniwang failure modes ng machine translation — walang tahimik na fallback, walang basurang maisusulat sa inyong mga locale file.

## Mga Pagsusuri sa Validation

| Pagsusuri (Check) | Ano ang Nahuhuli Nito | Label ng Gate |
|-------|----------------|-----------|
| **Walang laman/blangko** | Nagbalik ang model ng walang laman na string o whitespace | `[GATE] empty` |
| **Echo ng source** | Nagbalik ang model ng orihinal na English na input | `[GATE] source-echo` |
| **Loop ng halusinasyon** | Paulit-ulit na mga pattern ng trigram (hal., `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Paglobo ng haba** | Ang output ay mas mahaba nang husto kaysa sa source | `[GATE] length` |
| **Pagbura ng nilalaman** | Ang output ay ang source na tinanggalan ng mga titik | `[GATE] content` |
| **Pagsunod sa script** | Maling script para sa target na locale | `[GATE] script` |
| **Mga kategorya ng plural ng ICU** | Nawawala ang mga kinakailangang anyo ng plural para sa locale | `[GATE] icu-plural` |

Ang mga key na idineklara bilang [`noTranslate`](/docs/getting-started/configuration#no-translate) ay hindi na po umaabot sa gate — kinokopya ang mga ito mula sa source nang verbatim, kaya wala na pong kailangang i-validate.

### Empty/Blank

Tinatanggihan ang mga salin na empty strings, whitespace-only, o `null`. Nahuhuli nito ang mga model na walang ibinabalik para sa mahihirap na key.

### Source Echo

Natutukoy kapag ibinabalik ng model ang English source text sa halip na isalin ito. Karaniwan ito sa maiikling string at mga prompt na kulang sa detalye.

Ang mga maiikling string na karamihan ay ASCII (≤ 30 character) ay hindi kasama (exempt) — ang `"Blog"`, `"GitHub"`, `"npm"` ay lehitimong nananatili sa English kahit saan, at ang pag-reject sa mga ito ay magdudulot po ng walang katapusang loop.

Ang mas mahahabang value na tama rin kahit hindi baguhin — mga URL, repository path, product identifier — ay hindi po problema ng gate at hindi maaayos sa pamamagitan ng pag-tune ng gate: ang tamang sagot *ay* ang echo, kaya ang bawat posibleng output ng model ay mali. Ideklara po ang mga key na iyon gamit ang [`noTranslate`](/docs/getting-started/configuration#no-translate) at lalampasan ng mga ito ang pipeline nang buo. Ang mga key na may value na URL ay pinangangasiwaan sa ganoong paraan bilang default.

### Hallucination Loop

Sinusuri ang mga trigram (3-character) pattern sa output. Kung may anumang trigram na umuulit nang higit sa threshold na bilang kaugnay ng haba ng output, tinatanggihan ang salin. Nahuhuli nito ang degenerate outputs tulad ng `"Qo' Qo' Qo' Qo' Qo'"`.

### Length Inflation

Tinatanggihan ang mga salin kung saan lumalampas ang haba ng output sa `maxLengthRatio × source length` (default: 4×). Nahuhuli nito ang mga hallucination ng model na gumagawa ng mahahabang pader ng teksto para sa maikling input.

Maaaring i-configure sa pamamagitan ng `maxLengthRatio` sa inyong config.

### Pagbura ng Nilalaman

Ang kabaligtaran ng paglobo ng haba (length inflation). Ang isang model na walang bokabularyo para sa isang string ay maaaring magbura ng bawat titik na hindi nito kayang isalin at iiwan na lamang ang mga bantas at espasyo ng source:

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Wala na pong ibang makakahuli nito. Hindi ito walang laman, hindi isang echo, hindi paulit-ulit, at sa 33% ng *haba* ng source ay madali nitong napapasa ang `minLengthRatio`.

Inihahambing ng pagsusuri ang mga **character ng nilalaman (content characters)** — mga titik at numero, hindi pinapansin ang mga bantas, whitespace, at hindi nakikitang formatting — sa pagitan ng source at output. Ngunit hindi po maaaring density lamang ang maging panuntunan, dahil ang mga lehitimong dense na script ay nasa parehong sitwasyon:

| Source | Output | Napanatiling nilalaman | Hatol |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **tinanggihan** |
| `Getting started` | `入门` | 14% | tinanggap |
| `Frequently asked questions` | `常见问题` | 17% | tinanggap |

Anumang threshold na makakahuli sa una ay tahasang magre-reject sa Chinese, Japanese, at Korean. Ang naghihiwalay sa kanila ay hindi kung gaano karami ang natira kundi *kung saan ito nagmula*: ang pinabawasang output ay isang **subsequence** ng sarili nitong source — na maaaring magawa sa pamamagitan ng pagbura ng mga character mula rito — habang ang isang tunay na salin ay halos walang ibinabahagi sa source. Ang isang flag ay nangangailangan ng **parehong** signal, kaya ang pagsusuri ay kinakailangan-ngunit-hindi-sapat sa parehong paraan ng repetition detector.

Maaari po itong i-configure gamit ang `minContentRetention` (default ay `0.35`), bawat pares o bawat wika. Ang pagpapataas nito ay nagpapaging mas sensitibo sa pagsusuri; nag-a-activate lamang ito kasabay ng subsequence signal.

:::note[Ito ay isang signal ng bokabularyo, hindi isang dial ng kalidad]
Kapag paulit-ulit po itong nag-a-activate para sa isang target na wika, nangangahulugan itong walang mga salita ang model para sa text na iyon — kadalasang maiikli at puno ng jargon na mga string sa isang wika na may saradong leksikon. Ang pagluluwag sa threshold ay magbabalik lamang sa tahimik na korapsyon (silent corruption); hindi po ito lilikha ng salin. Ayusin po ang prompt, ang coaching data, o ang pares.
:::

### Script Compliance

Para sa mga locale na ang language card ay nagtatala ng hindi Latin na script (Arabic, CJK, Cyrillic, …), bini-validate po nito na ang output ay talagang naglalaman ng mga hindi ASCII na character — ang output na puro Latin lamang para sa mga locale na iyon ay ire-reject bilang maling script (wrong-script).

Dalawang paglilinaw tungkol sa kung ano ang *hindi* saklaw ng pagsusuring ito:

- Ito ay **hindi nakadepende sa `script:` config field.** Pinipili ng field na iyon ang output orthography para sa [script conversion](/docs/getting-started/configuration#script-conversion); ang inaasahan ng gate ay nagmumula sa mga language card.
- Palagi po nitong bini-validate ang **working script na inilalabas ng model**, *bago* ang anumang script conversion. Ang mga locale na may script converter (crk, sr, tlh, …) ay tamang naglalabas ng Latin na working-script output, kaya hindi po sila kasama sa pagsusuring ito; ang conversion — kung pinili sa config — ay nangyayari pagkatapos ng gate.

## Ano ang Mangyayari Kapag Nabigo

1. Ang nabigong salin ay nila-log sa stderr na may `[GATE]` prefix, ang pangalan ng key, ang dahilan, at isang preview ng value
2. Ang key ay **hindi** isinusulat sa locale file
3. Magsisimula ang retry cascade (tingnan sa ibaba)

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Feedback Retry at ang Retry Cascade

Ang isang key na na-reject ng gate ay makakakuha ng **isang feedback retry**: ang dahilan ng pag-reject ay isinasama sa prompt bilang per-key context (ang isang blind retry sa mababang temperature ay magbabalik ng byte-identical na output). Kung pumasa ang retry, isusulat ang key at ang sync ay magiging **green** — ang isang gate rejection na nag-self-heal ay hindi po isang failure, at ito ang sinadyang semantics. Tanging ang mga key na nabibigo pa rin pagkatapos ng retry ang lalampasan, ire-report (ang sync ay mag-e-exit nang non-zero), at susubukan muli sa susunod na sync.

Ang retry ay dumadaan sa sariling paraan ng pagsasalin ng pares, anuman ito — LLM, Google Translate, DeepL, o isang direktang provider. Nalalapat din po ito sa mga Translation Memory hit: ang isang naka-cache na value na na-reject ng gate ay aalisin at isasalin muli sa parehong run, kaya ang isang sirang cache (poisoned cache) ay nag-aayos sa sarili nito.

Bukod pa rito, kapag nabigo ang isang buong batch (JSON parse error), ang champollion ay magre-retry gamit ang unti-unting mas maliliit na batch:

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

Ang retry budget ay nililimitahan ng `maxRetries` (default: 3, maaaring i-configure bawat wika). Pinipigilan nito ang runaway token spend sa mga key na palaging nabibigo.

Matapos maubos ang mga retry, ila-log at lalaktawan ang mga problemang key. Susubukan muli ang mga ito sa susunod na `sync` run.

## Prompt Caching

Ang system message (register, grammar rules, style notes) ay hinihiwalay mula sa user message (ang mga key na isasalin). Sinasadya ang paghahating ito:

- Ang system message ay **magkapareho sa lahat ng batch** para sa isang partikular na locale
- Nagca-cache ng paulit-ulit na system messages ang mga provider tulad ng Anthropic at Google
- Resulta: ang unang batch ang nagbabayad ng buong token cost, ang mga kasunod na batch ay nagbabayad lamang para sa user message

Maaari nitong makabuluhang mapababa ang token costs para sa mga proyektong maraming batch.

## ICU MessageFormat Validation

Bine-validate ng `integrity` command ang mga ICU MessageFormat plural pattern laban sa CLDR plural rules. Kung gumagamit ang inyong source file ng ICU syntax tulad ng:

```json
"items": "{count, plural, one {# item} other {# items}}"
```

Bine-verify ng Champollion na kasama sa mga isinaling bersyon ang lahat ng required plural categories para sa target locale. Halimbawa, nangangailangan ang Arabic ng anim na category (`zero`, `one`, `two`, `few`, `many`, `other`) — hindi lamang `one` at `other`.

Patakbuhin ang `champollion integrity` upang suriin ang plural completeness sa lahat ng locale.

## Terminology Enforcement

Para sa coached pairs na may dictionary, nagpapatakbo ang champollion ng post-translation terminology check. Pagkatapos makapasa sa quality gate, bine-verify nito kung aktuwal na ginamit ng LLM ang mga kinakailangang dictionary term.

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

Ang mga terminology violation ay **warnings, hindi blocking errors**. Isinusulat pa rin ang salin sa disk. Sinasadya ito — maaaring may wastong dahilan ang LLM sa pagpili ng alternatibo (context, grammar), at mas makapipinsala kaysa makabubuti ang pag-block dahil sa term mismatches.

Upang ayusin ang mga violation, i-update ang coaching dictionary o manu-manong i-edit ang locale file.

---

## Tingnan Din

- [Paano Gumagana ang Sync](/docs/concepts/how-sync-works) — kung saan pumapasok ang quality gate sa pipeline
- [Mga Paraan ng Pagsasalin](/docs/guides/translation-methods) — mga paraang nagpapapasok ng data sa gate
- [Mga Script Converter](/docs/concepts/script-converters) — post-gate script conversion
- [Coaching Data](/docs/concepts/coaching-data) — pagpapahusay ng kalidad ng salin upstream
- [Translation Memory](/docs/concepts/translation-memory) — pag-cache ng mga na-validate na salin
- [CLI Reference — sync](/docs/reference/cli#sync) — mga sync flag kabilang ang retry behavior
- [CLI Reference — integrity](/docs/reference/cli#integrity) — ICU plural auditing
