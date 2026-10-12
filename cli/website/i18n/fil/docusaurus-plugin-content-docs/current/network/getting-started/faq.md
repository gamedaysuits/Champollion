---
sidebar_position: 2
title: "Mga Madalas Itanong"
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

# Mga Madalas Itanong

> **Maikling Buod.** Mga sagot sa karaniwang tanong tungkol sa Champollion Network — kung paano gumagana ang scoring, ano ang nagdudulot ng disqualification, paano pangasiwaan ang mga wikang walang FST, mga rekomendasyon sa model at parameter, at ang proseso ng submission.

---

## Scoring at Metrics

### Anong metrics ang kinukuwenta ng harness?

Ang pangunahing sukatan (headline), at ang tanging bilang na nagpaparanggo sa isang run, ay ang **corpus chrF++** kasama ang 95% confidence interval nito. Katabi nito, inuulat ng harness ang iba pang mga karaniwang sukatan — **BLEU, spBLEU at TER**, at **COMET** kapag naka-install ito — bawat isa ay magkakahiwalay, hindi kailanman pinagsasama. Ang lahat ng iba pa ay isang **diagnostic**: hiwalay na inuulat upang ipaliwanag ang isang marka, hindi kailanman bahagi nito. Sinasaklaw ng talahanayan sa ibaba ang chrF++ at ang mga pangunahing diagnostic; tatlo ay language-agnostic at dalawa ay kasalukuyang umaasa sa mga CRK-specific na plugin at gagawing pangkalahatan habang nagpapalawak kami sa higit pang mga wika. Ang mga runnable reference corpora ngayon ay mga pampublikong set na may open-license — Global Voices, Tatoeba, TICO-19, IN22, SMOL, at marami pa (tingnan ang [Datasets](/docs/network/leaderboard/datasets)) — at bukas ang leaderboard para sa mga pagsusumite sa bawat nakarehistrong pares. Ang Plains Cree ay simpleng kung saan unang ipinatupad ang dalawang sukatang partikular sa wika (sinusuportahan ng FST).

| Sukatan | Sukat | Ano ang Sinusukat Nito | Katayuan |
|--------|-------|-----------------|--------|
| **chrF++** (headline) | 0–100 | Overlap ng character n-gram sa pagitan ng hinulaan at reference na mga salin, kinakalkula sa buong corpus gamit ang sacreBLEU (nakatala ang lagda nito). Ang karaniwang surface metric para sa mga wikang mayaman sa morpolohiya. | ✅ Lahat ng wika |
| **Exact match** (diagnostic) | 0.0–1.0 | Proporsyon ng mga entry kung saan ang hula ay eksaktong tumutugma sa reference pagkatapos ng normalisasyon. | ✅ Lahat ng wika |
| **FST acceptance** (diagnostic) | 0.0–1.0 | Proporsyon ng mga salitang output na tinatanggap ng isang finite-state transducer (morphological analyzer). Kinakalkula lamang kapag may ibinigay na FST binary. | ✅ Lahat ng wikang may FST |
| **Equivalent match** (diagnostic) | 0.0–1.0 | Bahagi ng mga entry na tumutugma sa reference o sa isang katanggap-tanggap na baryasyon — isinasaalang-alang ang ayos ng salita, kumbensiyon sa ortograpiya, at mga pagkakaiba sa diyalekto. | ⚡ CRK (isinasa-pangkalahatan) |
| **Semantic score** (diagnostic) | 0.0–1.0 | Marka ng pagpapanatili ng kahulugan — gaano kahusay nahuhuli ng salin ang nilalayong kahulugan anuman ang anyo sa ibabaw (surface form)? | ⚡ CRK (isinasa-pangkalahatan) |

Ang mga karagdagang diagnostic — **morphological accuracy**, **code-switching**, **terminology adherence**, **hallucination** at **writing style** — at ang katayuan ng pagpapatupad ng bawat sukatan ay nasa [Pagtukoy ng Pagmamarka §2](/docs/network/specifications/scoring#2-metric-inventory), ang kumpletong imbentaryo ng sukatan.

### Paano minamarkahan ang isang run?

Ang bawat bagong run ay minamarkahan sa ilalim ng pamantayan sa pagmamarka na `standard/1`, alinsunod sa paraan ng pag-uulat ng larangan sa pagsusuri ng MT (WMT, FLORES-200, AmericasNLP):

- **Headline:** corpus chrF++, nakasulat kasama ang 95% bootstrap CI nito at lagda ng sacreBLEU — halimbawa `chrF++ 47.5 [45.9, 49.0]`.
- **Katabi nito:** BLEU, spBLEU, TER, at COMET kapag kinalkula. Hindi kailanman pinagsasama.
- **Mga Diagnostic:** exact match, FST acceptance, morphological accuracy, code-switching, hallucination, terminology, writing style. Hiwalay na inuulat; hindi kailanman nagpaparanggo sa isang run ang mga ito.
- **Mga babala sa marka (score caveats)** ay nakalimbag mismo sa tabi ng headline kapag may natukoy ang harness na pattern na nagdudulot ng maling impresyon sa bilang.

Kung ang isang run ba ay **mas mahusay** kaysa sa isa pa ay pinagpapasyahan sa pamamagitan ng isang paired significance test sa chrF++ (`mt-eval compare --significance`), hindi sa pamamagitan ng paghahambing ng dalawang bilang. Buong mga panuntunan: [Paano minamarkahan ang mga run](/docs/network/specifications/scoring#how-runs-are-scored) at ang [Pagtukoy ng Kabuluhan](/docs/network/specifications/significance).

### Ano ang nangyari sa composite score at mga antas ng kalidad?

Parehong **itinigil na (retired)** ang mga ito para sa mga bagong run. Ang composite ay dating weighted blend ng chrF++, exact match, FST acceptance, at iba pang mga signal, at ang mga antas (Baseline → Fluent) ay mga label na ibinabatay dito. Ilan sa mga input nito ay hindi kailanman naghahambing ng output sa pinagmulan o reference, kaya maaaring makuha ng isang sistema ang halos kabuuan nito nang hindi nagsasalin: ang isang hindi sinanay na modelong English→Northern Sámi na nag-ulit ng isang wastong pangungusap para sa bawat input ay nakakuha ng 0.6244 — may label na "functional" — na may chrF++ na 5.5. Ang mga bagong run card ay naglalathala ng `composite: null` at `quality_tier: null`.

Ang mga card na inilathala bago ang pamantayan ay nagpapanatili ng kanilang nakaimbak na composite at nananatiling napapatunayan; saanman may ipinapakita ay may label itong **legacy composite (retired)**. Tingnan kung [bakit itinigil ang composite](/docs/network/specifications/scoring#why-the-composite-was-retired).

Ang isang awtomatikong marka ay hindi hatol sa kalidad. Tanging ang pagsusuri ng tao ng mga nagsasalita ng wika ang nagpapatunay ng kalidad.

### Ano ang mga antas ng pagpapatunay?

Inilalarawan ng **mga antas ng pagpapatunay (verification tiers)** kung *sino ang nagpatunay sa resulta*, hindi kung gaano ito kahusay:

| Antas ng Pagpapatunay | Ano ang Kahulugan Nito |
|-------------------|---------------|
| **Self-benchmarked** | Ang nagsumite mismo ang nagpatakbo ng harness. Kapani-paniwala ang mga marka ngunit hindi pa napapatunayan. |
| **Champollion Verified** | Muling ginawa ng isang maintainer ang resulta gamit ang isinumiteng pagsasaayos ng pamamaraan (method configuration). |
| **Community Validated** | Sinuri ng mga bilingguwal na nagsasalita ng target na wika, na kuwalipikado sa ilalim ng sariling protocol ng komunidad, ang isang stratified sample ng output (≥30 entry, ≥2 tagasuri) at ≥70% ang umabot sa pamantayan ng komunidad. Ipinagkakaloob lamang sa pamamagitan ng sariling pagsubok ng komunidad; ang pagbaba ng antas (demotion) sa pamamagitan ng spot-audit ay simetriko at kasing-publiko rin. |

Maaaring magkaroon ang isang run ng mataas na chrF++ at manatili pa ring "Self-benchmarked" lamang — ibig sabihin ay walang sinumang independiyenteng nagpatunay sa marka, at walang nagsasalita ng wika ang naghusga sa output.

---

## Submission at Disqualification

### Ano ang magdudulot ng disqualification sa aking submission?

Tatanggihan o ipa-flag ang inyong submission kung:

1. **Na-expose ang inyong method sa evaluation data.** Kung nag-train, nag-fine-tune, nag-few-shot-prompt, o gumamit sa ibang paraan ng anumang entries mula sa evaluation dataset, artipisyal na tataas ang inyong scores. Kasama rito ang paggamit ng reference translations sa inyong prompt.
2. **Hindi pumasa sa integrity checks ang inyong run card.** Dapat tumugma ang fingerprint sa configuration. Tinatanggihan ang tampered run cards.
3. **Hindi ini-implement ng inyong method ang TranslationMethod protocol.** Inaasahan ng harness ang `translate(entries, config) → results`. Hindi tinatanggap ang custom integrations na lumalampas sa harness.

### Maaari ba akong magsumite nang maraming beses?

Oo. Tina-track ng leaderboard ang lahat ng submissions. Maaari kayong mag-iterate — magpatakbo ng dose-dosenang eksperimento, at isumite lamang ang pinakamaganda. Nagtatala ang bawat submission ng natatanging fingerprint, kaya walang kalituhan kung aling run ang nag-produce ng aling score.

### Paano ko mapapa-verify ang aking score?

1. **Self-benchmarked:** Dito nagsisimula ang bawat pagsusumite, at sa kasalukuyan ang bawat hilera sa talaan ay narito pa rin.
2. **Champollion Verified:** Muling mamarkahan ng proyekto ang inyong mga isinumiteng output laban sa sha-pinned na reference corpus gamit ang sukatan ng harness. Kapag naulit ang inyong marka, itinataas ang run sa Champollion Verified — ang antas na ginagamit bilang default ng pagraranggo sa paligsahan, at ang tanging antas na karapat-dapat para sa isang premyo; inililista rin ng pampublikong talaan ang mga self-benchmarked na hilera, na may label na ganoon. Kung hindi ito maulit, o binago ang isang nakaimbak na reference, madidiskuwalipika ang run. Ang muling pagmamarka ay isang maintainer batch na manu-manong pinapatakbo: walang awtomatikong nagpapatakbo nito sa pagsusumite, at walang nag-iiskedyul nito.
3. **Community Validated:** Sinusuri ng mga bilingguwal na nagsasalita ng target na wika, na kuwalipikado sa ilalim ng sariling protocol ng komunidad, ang isang stratified sample ng output ng inyong pamamaraan — hindi bababa sa 30 entry, hindi bababa sa 2 tagasuri — at hindi bababa sa 70% ang dapat umabot sa pamantayan ng komunidad. Ipinagkakaloob lamang ang antas sa pamamagitan ng pagsubok na mismong pinapatakbo ng komunidad, ayon sa kanilang pagpapasiya, at maaaring bawiin sa parehong paraan: ibinababa ng isang nabigong spot-audit ang pamamaraan sa kasing-publikong paraan. Hindi ito maaaring i-automate — nangangailangan ito ng pakikipag-ugnayan sa komunidad.

### Bakit hindi ninyo muling pinapatakbo ang pamamaraan ng lahat upang mapatunayan ito?

Dahil hindi namin ito kayang tustusan at hindi naman kailangan. Libre ang muling pagmamarka ng mga isinumiteng output ng *lahat* (nahuhuli nito ang mga mano-manong tinipa o na-edit na marka). Ang aktwal na muling pagpapatakbo ng isang modelo ay nagkakahalaga ng tunay na compute, kaya mangyayari lamang ito sa isang **sample** na pinili sa pamamagitan ng **reputation-weighted auditing** — ang patakaran sa pag-sample ay binuo at nasubukan na, ngunit ang re-runner na magpapatakbo nito ay hindi pa, kaya wala pang sampled na re-run ang napagana at ang isang napiling run ay naitatala bilang *L2-pending*. Sa ilalim ng patakarang iyon, palaging pinipili ang isang run kung ito ay may mataas na pusta o high-stakes (nagsisilbi itong unang tulay sa isang buong pamilya ng wika) o anomalous (isang masyadong-maganda-para-maging-totoong pagtalon kumpara sa dating pinakamahusay), at bihira lamang itong i-spot-check mula sa mga napatunayang contributor. Ang reputasyon ay nakukuha lamang sa pamamagitan ng pagpasa sa mga audit na ito (o sa pamamagitan ng pagpapatibay ng isang independiyenteng contributor sa inyong resulta) — hindi kailanman sa dami — kaya walang napapala ang mga bagong throwaway na pagkakakilanlan. Ang isang nahuling katha (fabrication) ay nagpapawalang-bisa sa reputasyon ng isang contributor (nagiging zero), muling nag-aaudit sa kanilang buong na-verify na kasaysayan, at itinatala sa publiko, tulad ng isang pagbawi (retraction). **Hindi** namin sinasabing ang inyong run ay "dumaan sa harness" — para sa self-hosted compute na hindi nabe-verify sa server — kaya ang pagiging balido ay nakasalalay sa *reproducibility + reputation stake + corroboration*, hindi sa pagpapatunay (attestation). Tingnan ang [Mga panuntunan sa Pagsusuri ng MT](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) para sa buong modelo.

### Live na ba ang submission API?

Wala pa. Ang endpoint na `https://champollion.dev/api/leaderboard/submit` ay inaasam pa lamang. Ang kasalukuyang submission path ay `mt-eval publish` — nag-a-upload ito ng run card mula sa harness output directory (`eval/logs/harness/`) nang direkta sa leaderboard bilang *self-benchmarked (hindi beripikado)*.

---

## Models at Parameters

### Anong model ang dapat kong gamitin?

Walang iisang pinakamainam na model — nakadepende ito sa pares ng wika, sa inyong budget, at sa inyong approach. Pangkalahatang gabay:

| Uri ng Wika | Inirerekomendang Starting Point | Bakit |
|---------------|---------------------------|-----|
| **High-resource** (French, Spanish, Japanese) | `google/gemini-2.5-flash` o `gpt-4o-mini` | Mabilis, mura, matibay na baseline |
| **Low-resource na may kaunting LLM coverage** (Quechua, Yoruba) | `google/gemini-2.5-pro` o `anthropic/claude-sonnet-4` | Mas mahusay ang latent knowledge ng mas malalaking models |
| **Polysynthetic / very low-resource** (Plains Cree, Inuktitut) | `google/gemini-2.5-pro` na may coaching | Mas mahalaga ang coaching data kaysa sa pagpili ng model. Kasama sa OMT-1600 ang ilang polysynthetic languages (hal., CRK sa R1 tier) ngunit may standard BPE tokenization — i-benchmark ito bilang baseline sa Network. |

Gumagamit ang eval harness ng OpenRouter, kaya maaaring i-benchmark ang anumang model na available sa OpenRouter. Tingnan ang [openrouter.ai/models](https://openrouter.ai/models) para sa available na listahan.

### Anong temperature ang dapat kong gamitin?

Sa pangkalahatan, mas mababa ay mas mabuti para sa translation:

| Temperature | Epekto | Inirerekomenda Para Sa |
|-------------|--------|-----------------|
| **0.0 – 0.2** | Lubos na deterministic, consistent na output | Production methods, final benchmarks |
| **0.3 – 0.5** | May kaunting variation, paminsan-minsan ay mas creative | Exploration, maagang iteration |
| **0.6+** | Mataas ang variation, unpredictable | Hindi inirerekomenda para sa MT benchmarking |

Nakatala ang temperature sa run card, kaya ang magkakaibang temperatures ay gumagawa ng magkakaibang fingerprints — itinuturing ang mga ito bilang magkakaibang eksperimento.

### Nakakatulong ba ang coaching data?

Oo, malaki ang tulong nito — para sa low-resource languages. Ang coaching data (grammar rules, dictionary entries, style notes) ay ini-inject sa LLM system prompt. Para sa Plains Cree, ang methods na may coaching ay consistent na mas mahusay kaysa raw LLM methods para sa polysynthetic languages dahil limitado ang exposure ng general-purpose LLMs sa polysynthetic languages at wala silang morphological awareness. Kahit ang OMT-1600, na partikular na na-train para sa CRK, ay gumagamit ng standard BPE tokenization na hindi kayang kumatawan sa polysynthetic morphology nang structurally. Ibinibigay ng coaching data ang linguistic context na wala sa model.

Para sa high-resource languages (French, Spanish), mas maliit ang epekto ng coaching dahil mayroon nang matibay na baseline knowledge ang model.

Tingnan ang [Coaching Data](https://champollion.dev/docs/concepts/coaching-data) para sa buong specification.

---

## FST at Morphological Validation

### Paano kung walang FST para sa aking wika?

Maraming wika ang walang finite-state transducer. Ayos lang iyon — gumagana ang harness kahit wala nito. chrF++ pa rin ang headline sa alinmang paraan, kaya pareho ang pagmamarka sa mga run na mayroon at walang FST; ang FST acceptance ay isang diagnostic, at minamarkahan ito bilang `null` sa run card kapag walang ginamit na FST.

Ang pangunahing registries para sa umiiral na FSTs:

| Rehistro | Saklaw | URL |
|----------|----------|-----|
| **GiellaLT** | 100+ wika — ang mga wikang Sámi, Cree, Inuktitut, at marami pang ibang wikang Uralic at minorya | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Plains Cree, Tsuut'ina, Odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | ~60 pares ng wika, karamihan ay Europeo | [apertium.org](https://apertium.org/) |
| **UniMorph** | Mga paradigmang morpolohikal para sa 150+ wika | [unimorph.github.io](https://unimorph.github.io/) |

### Maaari ba akong gumawa ng FST?

Oo, ngunit hindi ito simple. Ine-encode ng FST ang morphological rules ng isang wika — lahat ng valid word forms. Ang paggawa nito ay nangangailangan ng malalim na kaalamang lingguwistiko sa wika. Kung may access kayo sa morphological grammar (hal., mula sa isang linguistics department), maaari itong i-compile bilang FST gamit ang mga tool tulad ng [HFST](https://hfst.github.io/) o [Foma](https://fomafst.github.io/).

### Paano gumagana ang FST gating sa praktika?

Ganito gumagana ang FST-gated pipeline:

1. Gumagawa ang LLM ng translation
2. Sinusuri ang bawat salita sa output laban sa FST
3. Ang mga salitang nirereject ng FST ay tina-flag bilang morphologically invalid
4. Maaaring mag-retry ang method gamit ang feedback ("hindi valid ang salitang X, subukan muli")
5. Pagkatapos ng retries, nilo-log ang natitirang invalid words

Sinusukat ng FST acceptance rate kung ilang salita ang pumapasa sa validation. Tingnan ang [FST-Gated Pipeline Tutorial](/docs/network/tutorials/fst-gated-pipeline) para sa kumpletong worked example.

---

## Data at Datasets

### Maaari ba akong mag-contribute ng dataset para sa bagong wika?

Oo. Minimum requirements mula sa [Benchmark Specification §11](/docs/network/specifications/benchmark#11-extending-to-new-languages):

- **50 gold-standard entries** (source + verified reference translation)
- **30 development entries** (maaaring mag-overlap sa gold standard para sa maliliit na corpora)
- **Community consent** (para sa Indigenous languages, explicit authorization mula sa governance body)
- **Provenance documentation** (saan nanggaling ang data, anong license ang naaangkop)

Awtomatikong nagbubukas ng bagong leaderboard tracks ang bagong datasets. Tingnan ang [Para sa Language Communities](/docs/network/community/for-language-communities) para sa contributor guide.

### Anong format dapat ang aking dataset?

JSON na may canonical field names:

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

Tingnan ang [Datasets](/docs/network/leaderboard/datasets) para sa buong schema at difficulty tier definitions.

---

## Sovereignty at Ownership

### Sino ang nagmamay-ari ng method na ginawa para sa isang Indigenous language?

Para sa mga Katutubong wika, ang isang pamamaraan na umaabot sa pamantayan ng premyo — ang awtomatikong threshold nito at pagpapatunay ng komunidad ng mga nagsasalita — ay nagpapasimula ng proseso ng [paglilipat ng pagmamay-ari](/docs/network/sovereignty/ownership-transfer) sa ilalim ng default na template. Ang pagmamay-ari ng code ay inililipat mula sa mananaliksik patungo sa organisasyon ng pamamahala ng komunidad ng wika.

Pinananatili ng researcher ang:
- Publication rights (academic papers tungkol sa method)
- Credit sa leaderboard
- Karapatang gamitin ang parehong *techniques* sa ibang wika

Nakakamit ng governance organization ang:
- Buong ownership ng method code at coaching data
- Kontrol sa deployment (kailan, saan, paano) — at lahat ng kinikita ng deployment. Non-commercial ang Champollion at hindi kumukuha ng share

### Maaari ko bang gamitin ang champollion para sa non-Indigenous languages nang walang anumang alalahanin sa sovereignty?

Oo. Para sa mga karaniwang wika (French, Japanese, Spanish, atbp.), walang mga pagsasaalang-alang sa soberanya. Gamitin ang champollion gaya ng dati — magsalin, mag-sync, maglathala ayon sa nais ninyo. Ang balangkas ng soberanya ay partikular na nalalapat sa mga Katutubo at pinamamahalaan ng komunidad na wika kung saan ang mga prinsipyo ng pamamahala ng data — pagmamay-ari at kontrol ng komunidad sa data ng wika, CARE, Te Mana Raraunga — ay nangangailangan ng espesyal na pagsasaalang-alang.

---

## Tingnan Din

- **[Paano Ito Gumagana](https://champollion.dev/how-it-works)** — ang buong solution explainer
- **[Scoring Specification](/docs/network/specifications/scoring)** — ang SSOT para sa lahat ng scoring logic (metrics, weights, tiers)
- **[Benchmark Specification](/docs/network/specifications/benchmark)** — evaluation protocol, corpus format, sovereignty
- **[Magsumite ng Method](/docs/network/getting-started/submit-a-method)** — step-by-step quickstart
- **[Leaderboard Rules](/docs/network/leaderboard/rules)** — submission criteria
- **[Data Stewardship](/docs/network/sovereignty/data-sovereignty)** — nananatili ang corpora sa kanilang stewards; iginagalang ang bawat license
