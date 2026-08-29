---
sidebar_position: 5
title: "Suportahan ang Isang Low-Resource Language"
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

# Suportahan ang Isang Wikang Low-Resource

> **Buod ng Tagapagpaganap.** Isang komprehensibong gabay sa pagbuo ng machine translation para sa mga wikang low-resource at polysynthetic. Sinasaklaw nito kung bakit mahirap ang mga wikang ito (morphological complexity, sparse data, hallucination), mga umiiral na computational resource (ALTLab FST, GiellaLT, Apertium, UniMorph, EdTeKLA), 10+ na estratehiya sa paglapit, ang champollion coaching system, at ang evaluation loop. Magsimula po rito kung nais ninyong mag-ambag ng isang pamamaraan para sa isang wikang kulang sa serbisyo.

:::info[Katayuan: Nasa Aktibong Pagbuo]
Ang suporta para sa Plains Cree (nêhiyawêwin) ay kasalukuyang binubuo pa po. Ang mga tool, evaluation harness, at leaderboard na inilalarawan dito ay totoo at magagamit na ngayon, ngunit ang Cree translation pipeline ay hindi pa po inilalabas. Kapag inilabas na ito, magsisilbi itong blueprint para sa iba pang mga wikang polysynthetic at low-resource na may imprastrukturang FST.
:::

## Ang Hindi Pa Nareresolbang Problema

Ang Cloud Translation service ng Google ay naglilista ng 194 na wika ([inilathalang listahan ng Google](https://docs.cloud.google.com/translate/docs/languages)). Ang OMT-1600 ng Meta (Marso 2026) ay nag-aangkin ng saklaw para sa 1,600 — ang pinakamalaking MT system na inilathala kailanman. Ngunit para sa ~1,200 na wika sa long tail nito — ang aming aritmetika: ang 1,600 na saklaw nito bawasan ng 400+ na iniulat ng mga may-akda nito na "sapat na nauunawaan" ng mga modelo — ang kalidad ay nasa ibaba ng mga magagamit na threshold, ang training data ay pinangungunahan ng teksto ng Bibliya, ang mga model weight ay hindi maaaring i-download, at walang independiyenteng pagsusuri o balangkas ng pamamahala ng komunidad. Para sa natitirang ~5,400 na wika, walang pretrained na modelo ang naglalabas ng anumang output.

Malaki na po ang ipinagbago ng sitwasyon — ang Big Tech ay namumuhunan na ngayon sa saklaw ng LRL. Ngunit ang saklaw ay hindi nangangahulugang kalidad, at ang kalidad na walang independiyenteng pagpapatunay ay hindi mapagkakatiwalaan. Ang mga wikang low-resource ay nangangailangan ng higit pa sa isang modelo na nag-aangking saklaw sila — kailangan nila ng independiyenteng pagsusuri na may morphological validation, mga corpora na pinangangasiwaan ng komunidad, at pamamahalang gumagalang sa soberanya.

**Binuo po ang champollion upang baguhin iyan.**

Ang [Method Leaderboard](https://champollion.dev/leaderboard) ay isang bukas na hamon: buuin ang pinakamahusay na pamamaraan ng pagsasalin para sa isang wikang kulang sa serbisyo, patunayan ito gamit ang reproducible na pagsusuri, at kunin ang pinakamataas na marka. Sinuman sa mundo ay maaari pong mag-ambag — mga lingguwista, mga mananaliksik ng ML, mga manggagawa sa wika ng komunidad, mga mag-aaral, mga hobbyist. Ang problema ay hindi pa nareresolba. Ang imprastruktura ay narito na. Naghihintay po ang leaderboard.

---

## Kung Bakit Ito Mahirap: Polysynthetic Morphology

Karamihan sa mga komersyal na MT system ay idinisenyo para sa mga wika tulad ng English, French, at Chinese — mga wika kung saan ang mga salita ay medyo maikli at ang mga pangungusap ay binubuo mula sa mga hiwalay na token. Ngunit maraming mga Katutubong wika, kabilang ang Plains Cree, ay **polysynthetic**: ang isang solong salita ay maaaring maglaman ng kung ano ang ipinapahayag ng English bilang isang buong pangungusap.

### Ang halimbawa ng Cree

Isaalang-alang po ang salitang Plains Cree na ito:

> **ê-kî-nitawi-kîskinwahamâkosiyân**
> *"nang ako ay pumasok sa paaralan"*

Iyan ay **isang salita** lamang. Nilalaman nito ang panahunan (nakaraan), direksyon (papunta sa), ang salitang-ugat (matuto), tinig (passive/reflexive), at panauhan (unang isahan). Ang isang LLM na sinanay pangunahin sa English ay walang intuwisyon para sa ganitong uri ng morphological density.

Nadadagdagan pa po ang mga hamon:

| Hamon | Ang Ibig Sabihin Nito |
|-----------|--------------|
| **Morphological complexity** | Ang isang solong pandiwang-ugat ay maaaring bumuo ng libu-libong wastong inflected na anyo sa pamamagitan ng prefixation, suffixation, at circumfixation |
| **Animate/inanimate na pagkakaiba** | Ang mga pangngalan ay gramatikal na animate o inanimate — nakakaapekto ito sa banghay ng pandiwa, mga demonstrative, at pluralization. Ang pag-uuri ay hindi palaging sumusunod sa biological animacy (ang *askiy* "lupa" ay animate; ang *maskisin* "sapatos" ay animate din) |
| **Obviation** | Ang mga pagtukoy sa ikatlong panauhan ay niraranggo ayon sa lapit/kahalagahan. Ang pagkakaiba ng "proximate" at "obviative" ay walang katumbas sa English |
| **Sparse training data** | Napakakaunting teksto ng Plains Cree ang nakita ng mga LLM. Ang mga nakita nila ay maaaring naghahalo ng mga diyalekto (Y-dialect, TH-dialect) o mga ortograpiya (SRO vs. syllabics) |
| **Mahinang commercial baseline** | Kasama sa OMT-1600 ang CRK sa R1 (Very Low Resource) tier na may pagsasanay sa domain ng Bibliya at karaniwang BPE tokenization. Hindi sinusuportahan ng Google Translate ang Cree. Ang independiyenteng pagsusuri na may mga morphological metric ang nagbibigay-kabuluhan sa mga baseline na ito. |

Ang pagsasalin ng mga wikang polysynthetic ay nananatiling isang **bukas na problema sa pananaliksik** — kasama sa OMT-1600 ang mga wikang polysynthetic ngunit gumagamit ito ng karaniwang BPE tokenization (256K na bokabularyo) na walang morphological awareness, na nangangahulugang pinupunit nito ang mga compositional na salita sa mga walang-kahulugang byte fragment.

---

## Prior Art: Kung Paano Ito Nilapitan ng mga Tao

### Ang ALTLab FST

Ang pinakamahalagang computational resource para sa Plains Cree ay ang **finite-state transducer (FST)** na binuo ng [Alberta Language Technology Lab (ALTLab)](https://altlab.ualberta.ca/) sa University of Alberta, sa pakikipagtulungan ng [Giellatekno](https://giellatekno.uit.no/) sa UiT The Arctic University of Norway.

Ang ALTLab FST ay isang **morphological analyzer at generator**: kapag binigyan ng isang inflected na salitang Cree, maaari nitong paghiwa-hiwalayin ito sa salitang-ugat nito at mga grammatical tag, at kapag binigyan ng salitang-ugat kasama ang mga tag, maaari nitong buuin ang tamang inflected na anyo. Ito ay deterministic — walang neural network, walang hallucination, walang probability. Kung tatanggapin ng FST ang isang salita, ang salitang iyon ay morphologically valid.

Ito po ang dahilan kung bakit sinusubaybayan ng champollion leaderboard ang **FST Acceptance Rate** bilang isang sukatan. Ang isang pamamaraan ng pagsasalin na gumagawa ng mga salitang tinatanggihan ng FST ay gumagawa ng morphologically invalid na Cree — anuman ang sabihin ng marka ng chrF++.

**Mga pangunahing resource ng ALTLab:**
- [itwêwina](https://itwewina.altlab.app/) — isang matalinong diksyunaryong Plains Cree–English na pinapagana ng FST
- [Morphodict](https://github.com/UAlbertaALTLab/morphodict) — open-source na morphologically-aware na platform ng diksyunaryo
- [crk-db](https://github.com/UAlbertaALTLab/crk-db) — lexical database ng Plains Cree
- [21st Century Tools for Indigenous Languages](https://21c.tools/) — ang mas malawak na konteksto ng proyekto

### Mga Global FST at Morphological Registry

Hindi lamang po Plains Cree ang wika na may mataas na kalidad na imprastrukturang FST. Kung nais ninyong bumuo ng mga translation pipeline para sa iba pang mga wikang low-resource o morphologically complex, maaari po ninyong gamitin ang mga itinatag na global hub na ito:

* **[GiellaLT / Giellatekno](https://giellalt.github.io/) (UiT The Arctic University of Norway):** Ang pinakamalaking repositoryo ng mga open-source na FST morphological analyzer at generator, na sumasaklaw sa mahigit 100 wika. Kabilang sa mga pinagtutuunan ng pansin ang mga wikang Sámi (`sme`, `smj`, `sma`, atbp.), mga wikang Uralic (Komi, Erzya, Udmurt, atbp.), at iba pang mga minorya/katutubong wika. Nagho-host sila ng mga pampublikong processed text corpora (`corpus-xxx`) sa kanilang [GitHub Organization](https://github.com/giellalt/).
* **[The Apertium Project](https://www.apertium.org/):** Isang open-source na rule-based machine translation platform. Pinapanatili ng Apertium ang mga highly optimized na FST morphological analyzer (gamit ang `lttoolbox` at `hfst`) at mga bilingguwal na diksyunaryo para sa dose-dosenang wika, kabilang ang isang malaking suite ng mga wikang Turkic (Kazakh, Tatar, Kyrgyz, atbp.) at mga minoryang wika sa Europa. Ang lahat ng resource ay pampubliko sa [GitHub ng Apertium](https://github.com/apertium).
* **[UniMorph (Universal Morphology)](https://unimorph.github.io/):** Isang kolaboratibong proyekto na nagbibigay ng mga standardized na morphological paradigm para sa mahigit 150 wika. Ang dataset ay naka-host sa Hugging Face sa [unimorph/universal_morphologies](https://huggingface.co/datasets/unimorph/universal_morphologies). Kung walang available na compiled FST binary para sa isang wika, ang mga talahanayan ng UniMorph ay maaaring gamitin bilang isang static database lookup gate.
* **[National Research Council Canada (NRC)](https://nrc-digital-repository.canada.ca/):** Nag-aalok ng mga tool para sa mga Katutubong wika sa Canada, kabilang ang **Uqailaut** Inuktitut FST morphological analyzer at ang malaking **Nunavut Hansard Parallel Corpus** (1.3M na nakahanay na pares ng pangungusap sa English-Inuktitut).

### Ang EdTeKLA Corpus

Ang [EdTeKLA research group](https://spaces.facsci.ualberta.ca/edtekla/) (nasa UAlberta rin) ay nag-ipon ng isang corpus ng wikang Plains Cree mula sa mga materyal na pang-edukasyon, mga audio transcription, at mga mapagkukunan ng komunidad. Ang champollion evaluation dataset na [EDTeKLA Dev v1](/docs/network/leaderboard/datasets) ay hango sa gawaing ito, na inilathala sa ilalim ng [binagong CC BY-NC-SA ng EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (sovereignty-scoped, mga tuntuning hindi pangkomersyal).

### Iba pang mga pamamaraan na sinubukan o maaaring subukan ng mga tao

Ang leaderboard ay method-agnostic. Narito po ang mga estratehiya na na-explore o iminungkahi para sa low-resource MT, na alinman sa mga ito ay maaaring isumite:

| Pamamaraan | Paano Ito Gumagana | Mga Bentahe | Mga Disbentahe |
|----------|-------------|------|------|
| **[Coached LLM prompting](/docs/network/tutorials/coached-llm-prompting)** | Mag-inject ng mga panuntunan sa gramatika, mga diksyunaryo, at mga halimbawang pares sa system prompt | Mabilis i-iterate, hindi kailangan ng pagsasanay | Ang limitasyon sa kalidad ay nakadepende sa base knowledge ng LLM |
| **[Few-shot prompting](/docs/network/tutorials/few-shot-prompting)** | Isama ang mga na-verify na pagsasalin bilang mga in-context na halimbawa | Maganda para sa pare-parehong istilo | Maliit na context window; ang mga halimbawa ay HINDI dapat magmula sa eval data |
| **[FST-gated pipeline](/docs/network/tutorials/fst-gated-pipeline)** | Ang LLM ay bubuo → Ang FST ay magva-validate → tatanggihan at uulitin ang invalid na morphology | Ginagarantiyahan ang morphological validity | Nangangailangan ng imprastrukturang FST; ang mga retry loop ay nagdaragdag ng latency at gastos |
| **[Dictionary lookup + LLM](/docs/network/tutorials/dictionary-augmented-llm)** | Pilitin ang mga kilalang termino mula sa isang bilingguwal na diksyunaryo, hayaan ang LLM na hawakan ang natitira | Binabawasan ang hallucination para sa mga kilalang termino | Ang saklaw ng diksyunaryo ay palaging hindi kumpleto |
| **[Fine-tuned model](/docs/network/tutorials/fine-tuned-model)** | I-fine-tune ang isang open model (Llama, Mistral) sa parallel text — huwag lang sa eval data | Potensyal na pinakamataas na kalidad | Nangangailangan ng parallel corpus (bihira); mahal; panganib ng overfitting |
| **[Chained models](/docs/network/tutorials/chained-models)** | Ang Model A ay bubuo ng magaspang na pagsasalin → Ang Model B ay magpo-post-edit → Ang Model C ay magmamarka | Maaaring pagsamahin ang mga kalakasan ng mga espesyalista | Kumplikado; mabagal; mahal |
| **[Rule-based + LLM hybrid](/docs/network/tutorials/rule-based-hybrid)** | Gumamit ng mga linguistic rule para sa mga kilalang pattern, LLM para sa lahat ng iba pa | Tumpak kung saan naaangkop ang mga panuntunan | Nangangailangan ng malalim na linguistic expertise |
| **[Back-translation augmentation](/docs/network/tutorials/back-translation)** | Bumuo ng synthetic parallel data sa pamamagitan ng pagsasalin ng Cree→English, pagkatapos ay magsanay sa kabaligtaran | Pinapalawak ang training data nang mura | Pinalalaki ang mga umiiral na error ng modelo |
| **[Evolutionary approach](/docs/network/tutorials/evolutionary-approach)** | Bumuo ng mga kandidatong pagsasalin, markahan ang mga ito, i-mutate ang mga may pinakamahusay na performance, ulitin | Maaaring makatuklas ng mga bagong solusyon; parallelizable | Magastos sa computation; nangangailangan ng magandang fitness function |
| **[Partial translation](/docs/network/tutorials/partial-translation)** | Manu-manong isalin ang isang kinatawang sample, patunayan na ang inyong pamamaraan ay tumutugma sa inyong istilo rito, pagkatapos ay awtomatikong isalin ang natitirang bahagi | Pinagsasama ang kalidad ng tao sa sukat ng makina | Nangangailangan ng paunang pagsisikap ng tao |
| **Manual JSON / exam grading** | Manu-manong gumawa ng isang dataset JSON file upang subukan ang mga sagot ng mag-aaral sa isang pagsusulit sa wika, o markahan ang isang batch ng mga pagsasalin ng tao laban sa isang gold standard | Walang kinakailangang ML; gumagana para sa edukasyon at QA | Hindi nasusukat sa patuloy na mga pangangailangan sa pagsasalin |

### Ito ay JSON lamang

Ang harness ay tumatanggap ng JSON at naglalabas ng mga marka sa JSON. Ang [format ng dataset](/docs/network/leaderboard/datasets) ay simple lamang:

```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

Maaari po ninyo itong buuin nang manu-mano. Maaari ninyo itong i-export mula sa isang spreadsheet. Maaari ninyo itong buuin mula sa isang corpus. Maaari itong gamitin ng isang guro ng wika upang markahan ang mga pagsasalin ng mag-aaral. Maaari itong gamitin ng isang ahensya ng pagsasalin upang i-benchmark ang mga freelancer. Maaari itong gamitin ng isang research lab upang ihambing ang mga model architecture. Hindi mahalaga sa harness kung saan nagmula ang JSON — minamarkahan lamang nito ito.

At dahil ang production deployment framework ay tumatanggap ng parehong plugin interface, ang isang pamamaraan na nakakakuha ng mataas na marka sa harness ay maaaring i-deploy sa inyong website gamit ang isang pagbabago sa config. **Patunayan ito at gamitin ito.**

Ang mga posibilidad ay tunay na walang katapusan. **Kung mayroon po kayong ideya, buuin ito, patakbuhin ang harness, at isumite ang inyong mga marka.**

---

## Kung Paano Umaangkop ang champollion

Ang champollion po ang nagbibigay ng infrastructure layer — kayo ang magdadala ng pamamaraan.

### Ang coaching system

Ang `llm-coached` na pamamaraan ng champollion ay nagbibigay-daan sa inyo na mag-inject ng linguistic knowledge nang direkta sa LLM prompt:

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

Ang coaching data ay ini-inject sa bawat LLM prompt para sa pares na `en:crk`, na nagbibigay sa modelo ng structured linguistic context na hindi nito makukuha sa ibang paraan. Tingnan po ang [Coaching Data](https://champollion.dev/docs/concepts/coaching-data) para sa buong detalye.

### Mga Register

Ang register ay bahagi ng system prompt na nagdidirekta sa tono, pormalidad, at mga orthographic convention. Ang champollion ay may kasamang isang Plains Cree register:

```
nêhiyawêwin (Plains Cree). Use SRO (Standard Roman Orthography) as the working
script. Output will be converted to Syllabics via deterministic converter.
Professional register appropriate for educational and community contexts.
```

Maaari po ninyo itong i-override sa inyong config upang mag-eksperimento sa iba't ibang estratehiya sa pag-prompt:

```json title="champollion.config.json"
{
  "languages": {
    "crk": {
      "register": "Casual Plains Cree (Y-dialect). Use SRO. Prefer everyday vocabulary over formal or archaic terms. Address the reader directly."
    }
  }
}
```

Ang iba't ibang register ay gumagawa ng iba't ibang istilo ng pagsasalin — at iba't ibang marka sa leaderboard. Ang bawat pagsusumite ay nagtatala ng eksaktong register at system prompt na ginamit (bilang isang SHA-256 hash sa [run card](/docs/network/specifications/run-card)), kaya ang mga eksperimento ay reproducible.

### Script conversion

Ang Plains Cree ay isinusulat sa dalawang script: **Standard Roman Orthography (SRO)** at **Canadian Aboriginal Syllabics**. Ang pipeline ng champollion:

1. Isasalin ng LLM sa SRO (Latin-based, na mas madaling hawakan ng mga LLM)
2. Iva-validate ng quality gate ang SRO output
3. Iko-convert ng deterministic converter ang SRO → Syllabics
4. Ang na-convert na teksto ay isusulat sa disk

Hinahawakan ng converter ang lahat ng SRO diacritic (ê, î, ô, â para sa mga long vowel) at iminapa ang mga ito sa mga tamang syllabic character. Tingnan po ang [Script Converters](https://champollion.dev/docs/concepts/script-converters) para sa mga teknikal na detalye.

### Ang evaluation loop

Pinapatakbo ng [eval harness](/docs/network/specifications/harness) ang inyong pamamaraan laban sa evaluation dataset at gumagawa ng isang namarkahang [run card](/docs/network/specifications/run-card):

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

Ang `--name` flag ay isang label na inyong pinipili. Lumalabas ito sa leaderboard upang makita ng mga tao kung anong estratehiya sa prompt ang inyong ginamit. Itinatala ng harness ang buong system prompt sa run card, kaya ang inyong eksaktong pamamaraan ay reproducible.

:::tip[Mag-eksperimento nang malaya, isumite ang inyong pinakamahusay]
Ang harness ay idinisenyo para sa mabilis na iteration. Magpatakbo ng dose-dosenang eksperimento gamit ang iba't ibang modelo, coaching data, register, at kundisyon. Isumite lamang po sa leaderboard kapag mayroon na kayong maipagmamalaki.
:::

---

## Mga Prinsipyo ng Data Sovereignty {#data-sovereignty-principles}

Ang champollion ay idinisenyo upang suportahan ang Indigenous data sovereignty. Ang pagmamay-ari, kontrol, pag-access, at pag-aari ng komunidad sa data ng wika ang gumagabay kung paano namin nilalapitan ang teknolohiya ng wika para sa mga Katutubong komunidad:

| Prinsipyo | Paano ito sinusuportahan ng champollion |
|-----------|------------------------|
| **Ownership (Pagmamay-ari)** | Pagmamay-ari ng mga komunidad ng wika ang kanilang linguistic data. Ang champollion ay hindi kailanman nagpapadala ng data pabalik sa aming mga server |
| **Control (Pagkontrol)** | Ang [API method](https://champollion.dev/docs/guides/serving-a-method) ay nagbibigay-daan sa mga komunidad na i-host ang kanilang sariling translation pipeline — ibinibigay namin ang interface, kinokontrol nila ang implementasyon |
| **Access (Pag-access)** | Ang mga komunidad ang nagpapasya kung sino ang maaaring gumamit ng kanilang pamamaraan. Ang API ay maaaring lagyan ng limitasyon sa pamamagitan ng authentication |
| **Possession (Pag-aari)** | Ang lahat ng data ng pagsasalin ay nananatili sa file system ng inyong proyekto. Sinusubaybayan ng [provenance system](https://champollion.dev/docs/concepts/security) kung saan nagmula ang bawat pagsasalin |

Nangangahulugan ang plugin architecture na ang isang komunidad ay maaaring bumuo ng isang pamamaraan na nagsasama ng sagrado o pinaghihigpitang kaalaman sa loob, ilantad lamang ang translation API, at mapanatili ang buong kontrol sa kanilang mga linguistic resource.

---

## Ang Bisyon: Ano ang Susunod

Ang Plains Cree po ang unang target. Kapag na-validate na ang pipeline at nasiyahan na ang komunidad sa kalidad, ang parehong arkitektura ay palalawakin sa iba pang mga wikang polysynthetic na may imprastrukturang FST:

- **Iba pang mga wikang Algonquian**: Woods Cree, Swampy Cree, Ojibwe, Blackfoot
- **Mga wikang Inuit**: Inuktitut, Inuinnaqtun (na gumagamit din ng mga syllabic script)
- **Iba pang mga pamilya ng wika**: anumang wika na may FST analyzer ay maaaring gumamit ng FST-gated pipeline

Ang leaderboard ay language-pair-scoped. Habang nag-aambag ng mga bagong evaluation dataset ang mga komunidad ng wika, awtomatikong magbubukas ang mga bagong track sa leaderboard.

**Ito po ay isang bukas na imbitasyon.** Kung nagtatrabaho kayo sa isang wikang low-resource — bilang isang mananaliksik, miyembro ng komunidad, mag-aaral, o simpleng nagmamalasakit lamang — binibigyan kayo ng champollion ng mga tool upang bumuo ng isang bagay na totoo, sukatin ito nang tapat, at ibahagi ito sa mundo. Naghihintay po ang [Method Leaderboard](https://champollion.dev/leaderboard) para sa inyong isusumite.

---

## Tingnan Din

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — isumite ang inyong mga marka at tingnan kung paano naghahambing ang mga pamamaraan
- **[MT Evaluation](/docs/network/leaderboard/rules)** — kung ano ang bumubuo sa isang magandang pamamaraan, kung ano ang nadi-disqualify
- **[Eval Harness](/docs/network/specifications/harness)** — kung paano magpatakbo ng mga eksperimento
- **[Evaluation Datasets](/docs/network/leaderboard/datasets)** — EDTeKLA Dev v1 at FLORES+
- **[Coaching Data](https://champollion.dev/docs/concepts/coaching-data)** — kung paano i-istruktura ang linguistic knowledge para sa LLM
- **[Script Converters](https://champollion.dev/docs/concepts/script-converters)** — ang SRO→Syllabics pipeline
- **[Serving a Method via API](https://champollion.dev/docs/guides/serving-a-method)** — pag-host ng pagsasalin na kontrolado ng komunidad
- **[ALTLab](https://altlab.ualberta.ca/)** — ang Alberta Language Technology Lab
- **[EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/)** — ang Educational Technology, Knowledge & Language research group
- **[itwêwina dictionary](https://itwewina.altlab.app/)** — diksyunaryong Plains Cree–English na pinapagana ng FST

