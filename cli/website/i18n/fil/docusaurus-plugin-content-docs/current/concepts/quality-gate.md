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

| Pagsusuri | Ang Nahuhuli Nito | Label ng Gate |
|-------|----------------|-----------|
| **Walang laman/blanko** | Nagbalik ang modelo ng walang lamang string o whitespace | `[GATE] empty` |
| **Echo ng source** | Ibinalik ng modelo ang orihinal na English input — nang walang pagbabago, o nakatago (mga accent, case, fullwidth letters), sa buong value o sa isang anyong maramihan (plural) | `[GATE] source-echo` |
| **Istruktura ng ICU / placeholder** | Isang naisaling variable, plural keyword o selector, nawawalang `#` o `%s` | `[GATE] icu` |
| **Markup** | Isang tag na binuksan, isinara, o ini-nest nang iba mula sa source | `[GATE] markup` |
| **Hati ng pangungusap sa tabi ng placeholder** | Isang dulo ng pangungusap na inilagay ng salin bago o pagkatapos mismo ng placeholder kung saan walang ganoon ang source: `Take this medicine at {time}.` → `… sina. {time}.` | `sentence break beside a placeholder` |
| **Hallucination loop** | Mga inulit na pattern ng trigram (hal., `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Paglobo ng haba** | Ang output ay higit na mas mahaba kaysa sa source | `[GATE] length` |
| **Pagtanggal ng nilalaman** | Ang output ay ang source na tinanggalan ng mga titik | `[GATE] content` |
| **Pagsunod sa script** | Maling script para sa target na locale | `[GATE] script` |
| **Parehong output, magkaibang input** | Isang text na ibinalik para sa ilang magkakaibang source string (isang sinaulong pangungusap) | `[GATE] shared-output` |
| **Mga kategorya ng ICU plural** | Nawawalang mga kinakailangang anyong plural para sa locale | `[GATE] icu-plural` |

Ang mga key na idineklarang [`noTranslate`](/docs/getting-started/configuration#no-translate) ay hindi kailanman umaabot sa gate — kinokopya ang mga ito mula sa source nang verbatim, kaya walang dapat i-validate.

**Sumasailalim din ang mga pahina ng Markdown sa parehong mga pagsusuri, bawat bloke.** Sa isang content folder (`contentDir`, mga Docusaurus doc), bawat heading, talata, list item, at cell ng talahanayan ay sinusuri nang mag-isa, gayundin ang bawat field ng front-matter. Ang mga pagsusuri ay ang mga nabanggit sa itaas: walang laman, echo ng source, hallucination loop, paglobo ng haba, pagtanggal ng nilalaman, script, at parehong output para sa magkaibang input. Ang isang maikling heading gaya ng `## Feast` na nagbalik bilang isang buong pangungusap ay tatanggihan, tulad ng app key na may parehong text.

Ang isang tinanggihang bloke ay **hihilingin muli nang isa pang beses, kasama ang dahilan**. Sasabihin sa modelo kung ano ang mali at ang text na tama naman ay maaaring ibalik nang walang pagbabago. May ilang pagtanggi na hindi mapagpapasyahan ng anumang nakatakdang panuntunan: ang isang heading na isang pangngalan (`### BLEURT (Sellam et al., 2020)`), isang entry sa listahan ng sanggunian, isang talahanayan ng mga code, o isang gloss ay maaaring tama eksakto sa pagkakasulat nito, o maaari namang isang napalampas na salin. Kung ang bloke ay bumalik nang walang pagbabago, o pinanatili sa Latin script sa isang wikang hindi Latin, at ang modelo ay nagbigay muli ng parehong sagot, tatanggapin ang sagot na iyon bilang sinasadya. Bawat iba pang pagtanggi ay dapat direktang pumasa sa gate sa ikalawang sagot. Ang isang endpoint na nagdedeklarang hindi ito sumusunod sa mga tagubilin (`"acceptsInstructions": false`) ay hindi na tatanungin muli; ang unang sagot nito ay huhusgahan na tulad ng ikalawang sagot.

Ang nananatiling tinanggihan ay mapupunta sa pamamaraang `fallback` ng pares. Kung walang ganito, **pananatilihin ng bloke ang source text nito, nang walang idinagdag na marker sa pahina**, hindi kailanman ike-cache, at ang lock entry ng pahina ay magiging `pending:<hash>`. Inililista ng `status` at `verify` ang mga naturang pahina, at pinapangalanan ng sync ang bawat bloke. Tatandaan ang pagtanggi: hindi na ipapadala ng susunod na payak na sync ang blokeng iyon sa parehong modelo muli (tingnan ang [Mga tinanggihang Markdown block at front-matter field](#refused-markdown-blocks-and-front-matter-fields)). Ang code, mga link, at markup sa isang bloke ay hiwalay na pinoprotektahan, at ang isang HTML comment ay hindi kailanman ipinapadala. May ilang text na pinapanatili ayon sa pagkakasulat nang hindi na itinatanong:
- isang maikling pangalan (`## GitHub`), na sinusukat nang hindi kasama ang inline code, mga panipi, panaklong, at `{#anchor}` nito;
- isang entry sa listahan ng sanggunian, o isang buong listahan ng sanggunian sa iisang bloke;
- mga fullwidth letter na ipinapakita mismo ng source.

Ang isang talahanayan ay sinusukat ayon sa mga cell nito, hindi sa mga pipe at delimiter row nito. Sinusuri ng `verify` ang mga blokeng nasa disk na sa parehong paraan, maliban sa isa na eksaktong tinanggap at na-cache ng sync para sa source nito. Ang isang blokeng bumagsak ay magiging babala, na magdudulot ng pagbagsak sa `verify --strict`, at may kasama itong command sa pag-aayos na `champollion sync --pair en:fr --redo files:<page>`. Ipi-print ng sync ang parehong command para sa parehong file.

### Empty/Blank

Tinatanggihan ang mga salin na empty strings, whitespace-only, o `null`. Nahuhuli nito ang mga model na walang ibinabalik para sa mahihirap na key.

### Source Echo

Tinutukoy kung kailan ibinabalik ng modelo ang English source text sa halip na isalin ito. Karaniwan ito sa maiikling string at mga prompt na kulang sa detalye. Dalawang panuntunan ang nalalapat, at magkaibang bagay ang sinusukat ng mga ito:

1. **Ang eksaktong kopya** (byte sa byte mula sa source) ay tinatanggihan — maliban sa isang **maikli at halos purong ASCII** na value: 30 character o mas kaunti, higit sa 80% ay payak na ASCII. Ang `"Blog"`, `"GitHub"`, `"npm"` ay lehitimong nananatili sa English, kaya sa isang target na may Latin-script, ang naturang kopya ay tinatanggap (inililista ito ng `verify` bilang isang source echo); sa isang hindi-Latin na target, tatanungin ang modelo nang isang beses kung ito ay isang pangngalan, at ang parehong sagot nang dalawang beses ay tatanggapin bilang ganoon. **Ang exemption na ito ay tungkol sa haba, at sumasaklaw lamang sa mga eksaktong kopya.**
2. **Isang nakatagong kopya** — ang source kung saan case, mga accent, spacing, mga hindi nakikitang character, o mga compatibility form (mga fullwidth letter, ligature) lamang ang binago — ay tinatanggihan kapag ang source ay may **tatlo o higit pang salita** na naglalaman ng mga titik (ang mga placeholder tulad ng `{count}` o `%s` at mga markup tag ay hindi kasama sa bilang), **gaano man ito kaikli**. Ang `"Book an appointment"` (19 na character, 3 salita) → `"Bóok án appóintment"` ay tinatanggihan; ang `"cafe"` → `"café"` (1 salita) ay tinatanggap, dahil ang isang tunay na salin ay maaaring magkaiba sa English sa mga accent lamang nito. Ang isang mas mahabang pangalan na lehitimong nagkakaroon ng mga accent (`"Universite de Montreal"`) ay tinatanggap kapag idineklara ninyo ang binagong spelling na may accent bilang isang protektadong termino.

Nalalapat din ang parehong panuntunan **sa bawat anyong plural**. Ang isang gettext `msgstr[n]` plural, isang ICU `{n, plural, …}` branch, o isang i18next `_one`/`_other` key ay sakop ng parehong mga panuntunan tulad ng isang isahang (singular) value: ang isang Russian plural na ang anyong `few` ay nagbalik bilang English na may mga accent ay tatanggihan tulad ng pagtanggi sa singular.

Ang mas mahahabang value na tama rin kahit hindi baguhin — mga URL, repository path, mga product identifier — ay hindi problema ng gate at hindi maaaring ayusin sa pamamagitan ng pag-tune sa gate: ang tamang sagot *mismo* ay ang echo, kaya bawat posibleng output ng modelo ay magiging mali. Ideklara ang mga key na iyon gamit ang [`noTranslate`](/docs/getting-started/configuration#no-translate) at lalagpasan ng mga ito ang pipeline nang buo. Ang mga key na may URL value ay pinangangasiwaan sa ganoong paraan bilang default.

### Hallucination Loop

Sinusuri ang mga trigram (3-character) pattern sa output. Kung may anumang trigram na umuulit nang higit sa threshold na bilang kaugnay ng haba ng output, tinatanggihan ang salin. Nahuhuli nito ang degenerate outputs tulad ng `"Qo' Qo' Qo' Qo' Qo'"`.

### Length Inflation

Tinatanggihan ang mga salin kung saan ang haba ng output ay lumalampas sa `maxLengthRatio × source length` (default: 4×) — mahigpit na mas marami: ang isang salin na eksaktong 4× ay papasa. Nahuhuli nito ang mga hallucination ng modelo na naglalabas ng napakaraming text para sa isang maikling input.

Maaaring i-configure sa pamamagitan ng `maxLengthRatio` sa inyong config.

### Pagtanggal ng Nilalaman

Ang kabaligtaran ng paglobo ng haba. Ang isang modelong walang bokabularyo para sa isang string ay maaaring magtanggal ng bawat titik na hindi nito maisalin at iwanan lamang ang bantas at spacing ng source:

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Walang ibang nakakahuli nito. Hindi ito walang laman, hindi isang echo, hindi paulit-ulit, at sa 33% ng *haba* ng source, komportable nitong nalalampasan ang `minLengthRatio`.

Inihahambing ng pagsusuri ang **mga content character** — mga titik at digit, habang binabalewala ang bantas, whitespace, at invisible formatting — sa pagitan ng source at output. Ngunit hindi maaaring density lamang ang maging batayan, dahil ang mga lehitimong dense script ay pumapasok sa eksaktong parehong sukat:

| Source | Output | Napanatiling content | Hatol |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **tinanggihan** |
| `Getting started` | `入门` | 14% | tinanggap |
| `Frequently asked questions` | `常见问题` | 17% | tinanggap |

Ang anumang threshold na makakahuli sa una ay tatanggi agad sa Chinese, Japanese, at Korean nang tuluyan. Ang naghihiwalay sa kanila ay hindi kung gaano karami ang natira kundi *kung saan ito nanggaling*: ang bawas na output ay isang **subsequence** ng sarili nitong source — na mabubuo sa pamamagitan ng pagtanggal ng mga character mula rito — habang ang isang totoong salin ay halos walang kapareho sa source. Ang isang flag ay nangangailangan ng **parehong** senyales, kaya ang pagsusuri ay kinakailangan-ngunit-hindi-sapat sa parehong paraan ng repetition detector.

Maaaring i-configure sa pamamagitan ng `minContentRetention` (default `0.35`), bawat pares o bawat wika. Ang pagtaas nito ay nagiging dahilan upang maging mas agresibo ang pagsusuri; gumagana lamang ito kasabay ng subsequence signal.

:::note[Ito ay senyales ng bokabularyo, hindi dial ng kalidad]
Kapag paulit-ulit itong gumagana para sa isang target na wika, ang modelo ay walang mga salita para sa text na iyon — kadalasan ay maiikli at punong-puno ng jargon na mga string sa isang wikang may limitadong lexicon. Ang pagluluwag sa threshold ay nagbabalik lamang sa tahimik na pagkasira; hindi ito gumagawa ng salin. Ayusin ang prompt, ang coaching data, o ang pares.
:::

### Script Compliance

Para sa mga locale na ang language card ay nagtatala ng hindi-Latin na script (Arabic, CJK, Cyrillic, …), bini-validate nito na ang output ay hindi puro Latin lamang. Iniuuri ang mga titik ayon sa **Unicode script**, hindi ayon sa byte: ang Latin na may accent (`"Bóók"`) at fullwidth Latin (`"Ｂｏｏｋ"`) ay Latin, kaya walang alinman sa mga ito ang papasa bilang Russian. Tinatanggihan ang mga fullwidth Latin letter sa anumang target sa labas ng tipograpiya ng CJK (kung saan ang `"ＯＫ"` ay karaniwang gamit sa Japanese) — ang mga ito ay English na nakatago lamang. Nananatili ang karaniwang mga palugit: ang isang maikling pangalan na pinanatili ayon sa pagkakasulat (ang tanong sa pangalan-o-label sa itaas), mga idineklarang protektadong termino, at mga `noTranslate` key (kabilang ang mga URL) ay hindi kailanman babagsak dito.

Dalawang paglilinaw tungkol sa kung ano ang *hindi* saklaw ng pagsusuring ito:

- Ito ay **hindi pinapatakbo ng config field na `script:`.** Pinipili ng field na iyon ang output orthography para sa [script conversion](/docs/getting-started/configuration#script-conversion); ang inaasahan ng gate ay nanggagaling sa mga language card.
- Palagi nitong bini-validate ang **working script na inilalabas ng modelo**, *bago* ang anumang script conversion. Ang mga locale na may script converter (crk, sr, tlh, …) ay wastong gumagawa ng Latin working-script na output, kaya exempted sila sa pagsusuring ito; ang conversion — kung pinili sa config — ay nagaganap pagkatapos ng gate.

### Markup

Ang mga tag ay code. Bawat pangalan ng tag, dapat magbukas, magsara, at mag-self-close ang salin ng parehong bilang ng mga tag tulad ng source, na ini-nest ang mga ito sa parehong paraan (ang `<b>` sa loob ng `<a>` ay nananatili sa loob ng `<a>`); ang pagkakasunod-sunod ng magkakapatid na tag ay maaaring magbago kasabay ng ayos ng salita. Ang `"Please <strong>book</strong> now"` → `"Veuillez <strong>réserver maintenant"` ay tinatanggihan — ang nawawalang pansarang tag ay sumisira sa pahina. Sa isang plural na mensahe, ang bawat anyo ay inihahambing sa anyo ng source na isinasalin nito. Pinapatakbo ng `verify` ang parehong pagsusuri sa mga file.

### Hati ng Pangungusap sa Tabi ng Placeholder

Ang isang placeholder ay pinupunan sa oras ng pagpapatakbo (runtime), kaya ang dulo ng pangungusap na inilalagay ng salin katabi mismo nito ay nagpapabago sa nakikita ng mambabasa: ang `"Take this medicine at {time}."` → `"… sina. {time}."` ay nagpapakita ng oras bilang sarili nitong pangungusap. Tinatanggihan ng gate ang isang salin na naglalagay ng dulo ng pangungusap (`.`, `!`, `?`, o bantas ng ibang script: `。`, `？`, `।`, `؟`, `።`, `᙮`, …) sa **bago** mismo ng placeholder, o **kasunod** mismo nito na may karagdagang text na sumusunod, kung ang source ay walang bantas doon at ang salin ay may mas maraming dulo ng pangungusap kaysa sa source. Ang isang placeholder na lumipat lamang sa dulo ng pangungusap (`"Shipped by {carrier} on {date}."` → `"Expédié le {date} par {carrier}."`) ay papasa. Gayundin ang ellipsis, decimal, o pangalan ng file (`{host}.com`), at ang isang-titik na abbreviation (`"M. {name}"`). Ang isang mas mahabang abbreviation sa harap ng placeholder (`"ca. {count}"`) ay hindi maiiba sa dulo ng pangungusap, kaya tinatanggihan din ito, at ang fallback ng pares, o isang binagong sagot, ang kukuha nito. Tina-flag ng `verify` ang parehong mga value sa disk, kasama ang command na `--redo` na nagtatanong muli. Ang mga mensaheng ICU plural at select ay ipinauubaya sa pagsusuri ng ICU.

### Parehong Output, Magkaibang Input

Ang isang modelong nagsaulo ng isang pangungusap mula sa training ay maaaring magbalik nito para sa mga string na hindi nito alam: isang pangungusap para sa pamagat ng app, "Makipag-ugnayan sa paaralan", isang pamagat ng newsletter, at ang heading nito, kung saan bawat isa ay pumapasa sa lahat ng pagsusuri sa itaas nang mag-isa. Kapag ang isang salin ay sumagot sa **tatlo o higit pang magkakaibang source string** sa loob ng isang run ng locale — at mayroon itong apat o higit pang salita, o ang bawat source ay may dalawa o higit pang salita na halos walang pagkakatulad — ang mga key na iyon ay tinatanggihan (kaya ang retry, pagkatapos ay ang fallback, ang kukuha sa kanila). Ang **dalawang** magkaibang source string ay sapat na kapag matibay ang ebidensya: pareho silang may dalawa o higit pang salita, wala pang kalahati ng kanilang mga salita ang magkapareho, at ang pinagsaluhang salin ay may apat o higit pang salita (ang `"Thank you for coming!"` at `"Please bring the forms."` ay sinagot ng iisang pangungusap). Ang isang pangungusap na nahuli sa ganitong paraan ay tinatandaan para sa locale: ang susunod na sync na makakatanggap muli nito, kahit para sa iisang string, ay tatanggihan ito, at ang mga entry sa cache na nagsilbi na rito ay tatanggalin, upang ang muling pagsubok ay magtanong muli sa modelo sa halip na isulat ito mula sa cache. Ang mga synonym na bumabagsak sa iisang maikling salin (`"OK"`/`"Okay"`/`"Sure"` → `"D'accord"`, `"Close"`/`"Dismiss"` → `"Fermer"`) ay pumapasa, gayundin ang iisang source text na ginamit sa ilalim ng ilang key. Kasama rin sa bilang ang mga bloke ng Markdown at mga field ng front-matter ng mga content file ng run, at gayundin ang bawat branch ng isang ICU plural o select message (ang mga branch ng isang plural ay binibilang bilang isang source — ang isang wikang walang number inflection ay nagsusulat ng parehong text sa bawat isa). Inihahambing ang mga output nang hindi isinasaalang-alang ang case, bantas, at ang marker ng Markdown block, kaya ang `"S?"`, `"S."`, at isang heading na `# S` ay itinuturing na iisang output. Kasama sa bilang ang hawak na ng locale sa disk at kung ano ang ihahatid ng cache (ang isang pangungusap na na-cache nang paisa-isang text ng ibang tool ay tinatanggihan sa cache, hindi isinusulat), kaya nahuhuli rin ang isang key na idinagdag nang paisa-isang sync. Bumagsak ang `verify` sa parehong pattern sa disk, at tinatanggihan ito ng MCP `translate` tool sa loob ng isang call.

### Tanong na Nawalan ng Bantas

Kapag ang source ay nagtatapos sa `?` o `!` at ang salin ay hindi nagtatapos doon o sa katumbas na ginagamit ng script nito (`？`, `؟`, Greek na `;`, `¿…?`, `！`, …), nagbababala ang `sync` at `verify`: ang `"Where does it hurt?"` na isinulat bilang isang pahayag ay babasahin bilang ganoon. Isa itong babala, hindi pagtanggi, dahil may ilang wika na nagmamarka ng tanong gamit ang isang salita o kataga sa halip na bantas. Pinapangalanan ng babala ang mga key at ang command na `--redo keys:<key> --fresh` na magtatanong muli (`--fresh`, dahil hawak ng cache ang sagot).

## Ano ang Mangyayari Kapag Nabigo

1. Ang bumagsak na salin ay ilo-log sa stderr na may prefix na `[GATE]`, ang pangalan ng key, ang dahilan, at preview ng value
2. Ang key ay **hindi** isusulat sa locale file
3. Magsisimula ang retry cascade (tingnan sa ibaba)
4. Kung bumagsak pa rin ito, ang pagtanggi ay **tatandaan** (tingnan ang [Mga tinanggihang key ay pinipigilan](#refused-keys-are-held-back))

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Pag-retry Gamit ang Feedback at ang Retry Cascade

Ang isang key na tinanggihan ng gate ay nakakakuha ng **isang retry gamit ang feedback**: ang dahilan ng pagtanggi ay ipinapasok sa prompt bilang per-key context (ang isang bulag na pag-retry sa mababang temperature ay magbabalik ng eksaktong parehong output). Kung pumasa ang pag-retry, isusulat ang key at ang sync ay magiging **green** — ang pagtanggi ng gate na nagkukumpuni sa sarili ay hindi isang pagkabigo, at ito ang nilalayong gawi. Ang mga key na bumabagsak pa rin pagkatapos ng retry ay lalagpasan at iuulat (mag-e-exit ang sync nang may `2`).

Ang retry ay tumatakbo gamit ang sariling paraan ng pagsasalin ng pares, anuman ito — LLM, Google Translate, DeepL, o isang direktang provider. Mga pamamaraang LLM lamang ang nagbabasa ng feedback; sinasabi ito ng run line (`retrying with feedback`, o `asking once more (deepl takes no instructions…)`). Ang isang endpoint ng `api` ay nakakakuha lamang ng feedback kapag nagdeklara ito ng `"acceptsInstructions": true` (sa pares o sa plugin manifest nito); ang nagdedeklara ng `false` — isang sinanay na NMT model tulad ng `nmt-forge serve`, na sasagot din ng pareho — ay hindi na tatanungin muli: ang mga sagot nito ay huhusgahan kung paano huhusgahan ang isang ikalawang sagot, at ang tinatanggihan nito ay mapupunta sa fallback ng pares. Nalalapat din ang pag-retry sa mga hit sa Translation Memory: ang isang na-cache na value na tinanggihan ng gate ay aalisin at muling isasalin sa parehong run, kaya ang isang sirang cache ay nagkukumpuni sa sarili nito.

### Ang mga tinanggihang key ay pinipigilan

Ang isang pagtanggi ay itinatala sa `.champollion.lock`, bawat key, para sa **kasalukuyang source text** ng key at sa **paraan at modelong** naglabas ng tinanggihang sagot. Ang mga UI string ng Docusaurus (`i18n/<locale>/code.json` at ang mga JSON file ng mga plugin) ay sumusunod sa parehong patakaran, bawat file at id. Hindi na ipapadala ng susunod na payak na `sync` ang key na iyon sa parehong modelo muli — sisingilin lamang nito ang parehong sagot — at sasabihin kung ilan ang pinigilan at kung paano magpapatuloy:

- magtanong muli: `champollion sync --redo keys:<key>` (o `--redo all`, o `--fresh`) — ang pagpapangalan sa key ay isang tahasang pag-retry;
- punan ito sa ibang paraan: magdagdag ng pamamaraang `"fallback"` sa pares (hinihilingan ito para sa mga key na tinanggihan ng sariling pamamaraan ng pares), ilista ang key sa `noTranslate` kung mananatili ito ayon sa pagkakasulat, o isulat ang salin sa file nang manu-mano.

Ang isang pinigilang key ay nananatiling hindi naisasalin, kaya nag-e-exit ang sync nang may `2` hanggang sa mapunan ito. Ang pagbabago sa source text, sa modelo, o sa pamamaraan ay nag-aalis sa pagpigil (ang pagtanggi ay para sa text na iyon mula sa modelong iyon). Binabasa pa rin ang cache para rito — pinipigilan ng hold ang mga may-bayad na call, hindi ang mga libre. Ang isang key na hindi natapos ng redo ang tanging exception, tingnan sa ibaba.

### Mga tinanggihang Markdown block at front-matter field

Nalalapat ang parehong patakaran sa mga content file (`contentDir`, mga Docusaurus doc). Ang isang bloke o front-matter field na tinanggihan ng gate ay itinatala sa `.champollion-content.lock`, bawat pahina, bloke, at locale, para sa **kasalukuyang source text** ng bloke at sa **paraan at modelong** naglabas ng tinanggihang sagot. Pinapangalanan ang isang bloke gamit ang source text nito, kaya ang pag-edit sa talata ay nag-aalis sa pagpigil. Hindi na ito ipapadala ng susunod na payak na `sync` sa parehong modelo muli, at sasabihin kung ilang bloke at field ang pinigilan sa aling pahina:

- pinapanatili ng isang pinigilang bloke ang source text nito sa pahina, nang walang marker, hanggang sa mapunan ito; ang natitirang bahagi ng pahina ay isinusulat;
- pinapanatili ng isang pinigilang front-matter field ang source text nito sa parehong paraan, at ang natitirang bahagi ng pahina ay isinusulat;
- ang isang pahinang buong isinalin (`contentSegmentation: "page"`) ay buong tinatanggihan kapag ang sagot nito ay sumira sa isang protektadong bloke o nag-alis ng laman sa pahina. Itinatala ito ayon sa text ng katawan nito, at pinipigilan nang buo: hindi ito isinusulat, at walang ipinapadala mula rito, hanggang sa mapunan ito. Ang pag-edit sa katawan, o paglipat sa block segmentation, ay nag-aalis sa pagpigil.

Ang isang pagtanggi na ginawa ng mas lumang bersyon ng gate ay kusang naaalis. Kapag niluwagan ang isang pagsusuri, ang mga tinanggihan nito ay hihilingin muli sa susunod na sync, nang hindi nangangailangan ng redo.

Ang pagkakasunod-sunod ng prayoridad ay ang prayoridad ng mga key:

1. Ang isang pahinang pinangalanan para sa isang redo ay palaging ipinapadala: `champollion sync --redo files:<page>`, `--redo content` (bawat pahina), `--retranslate`, o anuman sa ilalim ng `--fresh`.
2. Kung hindi, ang isang tinanggihang bloke o field ay pinipigilan. Kung ang pares ay may pamamaraang `fallback` na hindi pa tumanggi rito, hihilingin ito sa fallback at hindi sa sariling pamamaraan ng pares.
3. Ang pagpapalit ng modelo o pamamaraan ay nag-aalis sa pagpigil, gayundin ang pagbabago sa source text ng bloke.

Binabasa pa rin muna ang cache, kaya pinipigilan ng hold ang mga may-bayad na call, hindi ang mga libre. Ang isang blokeng napunan sa ibang paraan ay nag-aalis ng talaan nito: sa pamamagitan ng fallback, ng cache, o ng isang talatang isinulat ninyo mismo sa salin (pinapanatili ng content folder ang talatang isinulat nang manu-mano). Ang isang pinigilang bloke o field ay hindi naisasalin, kaya nag-e-exit ang sync nang may `2` hanggang sa mapunan ito. Totoo rin ito sa isang blokeng tinanggihan ng gate sa run na ito. Inililista ng dry run kung ano ang pipigilan ng isang aktwal na run.

### Isang redo na hindi natapos

Kapag ang `--redo all`, `--redo keys:`, o ang pagpapalit ng modelo (`--redo all --fresh-on-model-change`) ay nag-iwan ng mga key ng isang key-value file na hindi naisalin, itinatala ang mga ito bilang **pending** sa `.champollion.lock`, at hihilingin ng susunod na payak na `sync` ang mga ito sa modelo nang isa pang beses — mula sa modelo, hindi sa cache (ang layunin ng redo ay ang text ng bagong modelo). Inililista ang mga ito ng `champollion status`. Kung ang retry na iyon ay tinanggihan din, mananatiling pending ang key (sinasabi ito ng status) at pipigilan tulad ng anumang tinanggihang key. Sa pagkakasunod-sunod ng prayoridad: ang isang key na pinangalanan ng `--redo`/`--fresh` ay palaging ipinapadala; ang isang pending na key ay nakakakuha ng isang pag-retry na iyon; ang isang tinanggihang key ay pinipigilan. Ang isang Docusaurus UI string ay walang pending retry: kapag tinanggihan sa ilalim ng redo, pinipigilan ito ng susunod na payak na sync, tulad ng isang content block.

Hiwalay rito, kapag bumagsak ang isang buong batch (JSON parse error), muling sumusubok ang champollion gamit ang unti-unting lumiliit na mga batch:

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

Ang retry budget ay nililimitahan ng `maxRetries` (default: 3, maaaring i-configure bawat wika). Pinipigilan nito ang runaway token spend sa mga key na palaging nabibigo.

Pagkatapos maubos ang mga retry, ang mga may problemang key ay ilo-log at lalagpasan. Ang isang key na walang nakuhang magagamit na sagot (nawawala sa tugon) ay hihilingin muli ng susunod na `sync`; ang isang key na tinanggihan ng gate ay pinipigilan, tulad ng nasa itaas.

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

### Mga anyong plural na hindi ibinigay ng salin

Pinapangalanan ng prompt ang mga kategorya ng CLDR ng target na wika. Kapag ang isang mensaheng plural ay nagbalik nang wala ang isa sa mga ginagamit ng wika para sa karaniwang pagbilang (anumang bilang mula 0 hanggang 1000 — Russian `few` para sa 2, 3, 4 at `many` para sa 0, 5, 6), tatanungin ng gate ang modelo nang isa pang beses, na pinapangalanan ang mga nawawalang anyo at ang mga bilang na sinasaklaw ng mga ito. Ang ikalawang sagot na wala pa rin ang mga ito ay tatanggapin, hindi na tatanungin sa ikatlong pagkakataon, at hindi kailanman kukumpletuhin ng tool — pagkatapos ay ang sync:

- magbababala, na pinapangalanan ang bawat key at ang mga nawawalang anyo nito, at ang command na magtatanong muli (`sync --redo keys:… --fresh`, kung saan nakakatulong ang mas matatag na `--model`);
- sa isang gettext catalog, kung saan kailangan ng `msgfmt` ang bawat `msgstr[n]`, isusulat ang mga nawawalang anyo bilang mga kopya ng `other` at mamarkahan ang entry gamit ang isang `# champollion:` na translator comment (ipinapakita ito ng Poedit at Weblate; binabasa ito ng `verify`, gayundin sa CI nang walang cache);
- sa mga ICU file (next-intl, ARB), isusulat ang mensahe ayon sa pagdating nito; ipapakita ng app ang anyong `other` para sa mga bilang na iyon.

Ang gayong mensahe ay hindi ituturing na naisalin. Ang susunod na sync na magpapatakbo ng ibang pamamaraan o modelo — isa na hindi pa sumasagot dito, tulad ng hosted model ng CI pagkatapos ng isang lokal — ay hihilingin itong muli, mula sa modelo, hindi mula sa cache (na naglalaman ng hindi kumpletong sagot); itatakda ng estimate ang presyo nito. Hihilingin ng `sync --redo gaps` ang bawat naturang mensahe, sinuman ang nag-iwan nito. Kung kulang din sa mga anyo ang bagong sagot, mananatili ang mensahe ayon sa dati (minarkahan sa isang catalog), at itatala ng `.champollion.lock` kung aling mga setup ang sumagot nang wala ang mga ito, upang walang sinuman sa kanila ang tatanungin muli para sa parehong text ([Gabay sa CI](/docs/guides/ci-cd#plural-gaps)).

Iniuulat ng `verify` ang parehong sitwasyon kasama ang command sa pag-aayos. Ang mga anyong naaabot lamang nang higit sa 1000 o sa pamamagitan ng fraction (French at Spanish na `many`, na ginagamit para sa 1 000 000) ay makakatanggap ng linya ng info, hindi babala. Ang isang machine translation engine (DeepL, Google, …) ay hindi maaaring sabihan kung aling mga anyo ang isusulat, kaya ang sagot nito ay hindi na ini-retry — iniuulat lamang. Para sa mga i18next file, bawat anyo na wala sa source (French `count_many` mula sa English) ay sarili nitong key, na isinalin mula sa text ng `_other`: hihilingin sa isang LLM ang anyong iyon, at sasabihin ito ng sync; sa isang machine translation engine, sasabihin nitong hawak ng value ang anyong `other`.

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
