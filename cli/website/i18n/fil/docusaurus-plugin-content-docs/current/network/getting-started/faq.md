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

Ang harness ay nagkukuwenta ng limang sukatan. Tatlo ay hindi nakadepende sa wika at gumagana para sa anumang pares ng wika; dalawa sa kasalukuyan ay umaasa sa mga CRK-specific plugin at gagawing mas pangkalahatan habang nagpapalawak tayo sa mas marami pang wika. Ang runnable reference corpora sa ngayon ay mga pampublikong set na may open license — Global Voices, Tatoeba, TICO-19, IN22, SMOL, at iba pa (tingnan ang [Datasets](/docs/network/leaderboard/datasets)) — at bukas ang leaderboard para sa mga submission sa bawat nakarehistrong pares. Ang Plains Cree lamang ang lugar kung saan unang ipinatupad ang dalawang language-specific (FST-backed) na sukatan.

| Metric | Scale | Ano ang Sinusukat Nito | Status |
|--------|-------|-----------------|--------|
| **chrF++** | 0–100 | Character n-gram overlap sa pagitan ng predicted at reference translations. Pinakamahusay na surface metric para sa mga wikang may mayamang morpolohiya. Gumagamit ng native scoring ng sacrebleu. | ✅ Lahat ng wika |
| **Exact match** | 0.0–1.0 | Proporsyon ng entries kung saan eksaktong tumutugma ang prediction sa reference pagkatapos ng normalization. | ✅ Lahat ng wika |
| **FST acceptance** | 0.0–1.0 | Proporsyon ng output words na tinatanggap ng finite-state transducer (morphological analyzer). Kinukuwenta lamang kapag may ibinigay na FST binary. | ✅ Lahat ng wikang may FST |
| **Equivalent match** | 0.0–1.0 | Bahagi ng entries na tumutugma sa reference o sa isang katanggap-tanggap na variant — isinasaalang-alang ang ayos ng salita, orthographic convention, at mga pagkakaibang dialectal. | ⚡ CRK (ginagawang pangkalahatan) |
| **Semantic score** | 0.0–1.0 | Meaning preservation score — gaano kahusay nakukuha ng translation ang nilalayong kahulugan anuman ang surface form? | ⚡ CRK (ginagawang pangkalahatan) |

May nakaplanong karagdagang metrics: **morphological accuracy**, **code-switching detection**, **terminology adherence**, at **hallucination detection**. Tingnan ang [Scoring Specification §2](/docs/network/specifications/scoring#2-metric-inventory) para sa buong metric inventory (anim na kategorya).

### Paano kinukuwenta ang composite score?

Ang composite ay weighted average ng available metrics, na normalized sa 0.0–1.0 scale. Ang weights ay tinutukoy sa dalawang profile:

- **Profile A** (mga wikang may FST): 9 metrics, ang structural metrics (FST + morphological accuracy) ay may 40% ng composite weight
- **Profile B** (mga wikang walang FST): 8 metrics, ang semantic at chrF++ ay may magkapantay na pinakamataas na weight

Kapag hindi available ang isang metric, ang weight nito ay muling ipinamamahagi nang proporsyonal sa natitirang metrics. Ibig sabihin, ang early-stage benchmarks (na chrF++ at exact match lamang ang available) ay nakakagawa pa rin ng valid composites — ipinapakita lamang ng effective weights kung ano ang available.

**Ang buong weight tables, normalization rules, at exclusion rationale ay nasa [Scoring Specification §4](/docs/network/specifications/scoring#4-composite-score).** Sinasalamin ng harness code ang mga table na ito sa `mt_eval_harness/scoring.py`. Ang chrF++ ay normalized sa pamamagitan ng paghahati sa 100 bago i-weight; ang code-switching at hallucination rates ay ini-invert (mas mababa = mas mabuti).

### Ano ang quality tiers?

Ang quality tiers ay heuristic labels na naka-map sa mga saklaw ng composite score. Tumutulong ang mga ito na ipabatid kung ano ang praktikal na *ibig sabihin* ng isang score:

| Tier | Composite Range | Interpretasyon |
|------|----------------|----------------|
| **Baseline** | 0.00 – 0.30 | Mas mababa sa kapaki-pakinabang na quality. Kailangan ng malaking pagpapahusay ang method. |
| **Emerging** | 0.30 – 0.50 | May potensyal. Tama ang ilang translations ngunit hindi consistent. |
| **Functional** | 0.50 – 0.70 | Magagamit bilang reference na may human review. Hindi angkop para sa unreviewed deployment. |
| **Deployable** | 0.70 – 0.85 | Handa para sa production use na may periodic review. Nagti-trigger ng eligibility para sa ownership transfer. |
| **Fluent** | 0.85 – 1.00 | Halos native ang quality. Angkop para sa unsupervised deployment. |

### Ano ang pagkakaiba ng quality tiers at verification tiers?

Inilalarawan ng **quality tiers** kung *ano ang ibig sabihin ng automated score* (Baseline → Fluent). Inilalarawan ng **verification tiers** kung *sino ang nag-validate sa resulta*:

| Antas ng Beripikasyon | Ano ang Ibig Sabihin Nito |
|-------------------|---------------|
| **Self-benchmarked** | Ang nagsumite po mismo ang nagpatakbo ng harness. Ang mga marka ay kapani-paniwala ngunit hindi pa beripikado. |
| **Champollion Verified** | Isang maintainer ang nag-reproduce ng resulta gamit ang isinumiteng configuration ng pamamaraan. |
| **Community Validated** | Ang mga bilingguwal na tagapagsalita ng target na wika, na kwalipikado sa ilalim ng sariling protocol ng komunidad, ay sumuri sa isang stratified sample ng output (≥30 entry, ≥2 tagasuri) at ≥70% ang nakapasa sa pamantayan ng komunidad. Iginagawad lamang sa pamamagitan ng sariling pagsubok ng komunidad; ang pagbaba ng antas (demotion) sa pamamagitan ng spot-audit ay simetriko at parehong pampubliko. |

Maaaring may "Deployable" quality ang isang method ngunit "Self-benchmarked" lamang ang verification — ibig sabihin, mahusay tingnan ang score ngunit wala pang nakapagkumpirma nito nang independent.

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

1. **Self-benchmarked (automatic):** Dito po nagsisimula ang bawat isinumite.
2. **Champollion Verified (automatic):** Muling minamarkahan po ng server ang inyong mga isinumiteng output laban sa sha-pinned reference corpus gamit ang harness metric. Kapag na-reproduce ang inyong marka, ang run ay iaangat sa Champollion Verified — ang tanging antas na nira-rank ng board. Kung hindi ito ma-reproduce, o kung may binagong naka-imbak na reference, madi-disqualify ang run.
3. **Community Validated:** Ang mga bilingguwal na tagapagsalita ng target na wika, na kwalipikado sa ilalim ng sariling protocol ng komunidad, ay sumusuri sa isang stratified sample ng output ng inyong pamamaraan — hindi bababa sa 30 entry, hindi bababa sa 2 tagasuri — at hindi bababa sa 70% ang dapat makapasa sa pamantayan ng komunidad. Ang antas na ito ay iginagawad lamang sa pamamagitan ng pagsubok na mismong ang komunidad ang nagpapatakbo, sa sarili nilang pagpapasya, at maaari ring bawiin sa parehong paraan: ang isang bagsak na spot-audit ay nagpapababa sa antas ng pamamaraan nang pampubliko rin. Hindi po ito maaaring i-automate — nangangailangan ito ng pakikilahok ng komunidad.

### Bakit hindi po ninyo muling pinapatakbo ang pamamaraan ng lahat upang ma-verify ito?

Dahil hindi po namin ito kakayanin at hindi rin po kailangan. Muling minamarkahan ng server ang mga isinumiteng output ng *lahat* nang libre (nahuhuli nito ang mga nai-type o na-edit na marka). Ang aktwal na muling pagpapatakbo ng isang modelo ay nangangailangan ng totoong compute, kaya ginagawa po namin ito sa isang **sample** na pinili sa pamamagitan ng **reputation-weighted auditing**: ang isang run ay palaging muling pinapatakbo kung ito ay high-stakes (nagbubukas ito ng unang tulay sa isang buong pamilya ng wika) o kahina-hinala (isang napakagandang pagtalon mula sa nakaraang pinakamahusay na hindi kapani-paniwala), at mula sa mga subok nang contributor, bihira po itong i-spot-check. Ang reputasyon ay nakukuha lamang sa pamamagitan ng pagpasa sa mga audit na ito (o sa pamamagitan ng isang independiyenteng contributor na nagpapatunay sa inyong resulta) — hindi kailanman sa dami — kaya walang napapala ang mga bagong gawang throwaway na pagkakakilanlan. Ang isang nahuling pamemeke ay nag-ze-zero sa reputasyon ng isang contributor, muling nag-o-audit sa kanilang buong na-verify na kasaysayan, at itinatala nang pampubliko, tulad ng isang retraction. **Hindi** po namin inaangkin na ang inyong run ay "dumaan sa harness" — para sa self-hosted compute na hindi nabe-verify ng server — kaya ang bisa nito ay nakasalalay sa *reproducibility + reputation stake + corroboration*, at hindi sa attestation. Tingnan po ang [MT Evaluation rules](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) para sa buong modelo.

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

Maraming wika ang walang finite-state transducer. Ayos lang iyon — gumagana ang harness kahit wala nito. Gumagamit ang composite score ng Profile B weights (tingnan ang [Scoring Specification §4.3](/docs/network/specifications/scoring#43-weight-tables)) na naglilipat ng weight sa semantic at surface metrics. Ang FST acceptance ay minamarkahan bilang `null` sa run card.

Ang pangunahing registries para sa umiiral na FSTs:

| Registry | Saklaw | URL |
|----------|----------|-----|
| **GiellaLT** | 100+ na wika — ang mga wikang Sámi, Cree, Inuktitut, at marami pang ibang wikang Uralic at minorya | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Plains Cree, Tsuut'ina, Odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | ~60 na pares ng wika, karamihan ay European | [apertium.org](https://apertium.org/) |
| **UniMorph** | Mga morphological paradigm para sa 150+ na wika | [unimorph.github.io](https://unimorph.github.io/) |

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

Para sa Indigenous languages, ang methods na umaabot sa Deployable tier (composite ≥ 0.70) AT pumapasa sa community validation ay nagti-trigger ng proseso ng [ownership transfer](/docs/network/sovereignty/ownership-transfer). Ang code ownership ay inililipat mula sa researcher papunta sa governance organization ng language community.

Pinananatili ng researcher ang:
- Publication rights (academic papers tungkol sa method)
- Credit sa leaderboard
- Karapatang gamitin ang parehong *techniques* sa ibang wika

Nakakamit ng governance organization ang:
- Buong ownership ng method code at coaching data
- Kontrol sa deployment (kailan, saan, paano) — at lahat ng kinikita ng deployment. Non-commercial ang Champollion at hindi kumukuha ng share

### Maaari ko bang gamitin ang champollion para sa non-Indigenous languages nang walang anumang alalahanin sa sovereignty?

Oo. Para sa standard languages (French, Japanese, Spanish, atbp.), walang sovereignty considerations. Gamitin ang champollion nang normal — mag-translate, mag-sync, mag-publish ayon sa inyong nais. Ang sovereignty framework ay partikular na naaangkop sa Indigenous at community-governed languages kung saan ang data-governance principles — pagmamay-ari at kontrol ng komunidad sa data ng wika, CARE, Te Mana Raraunga — ay nangangailangan ng espesyal na pagsasaalang-alang.

---

## Tingnan Din

- **[Paano Ito Gumagana](https://champollion.dev/how-it-works)** — ang buong solution explainer
- **[Scoring Specification](/docs/network/specifications/scoring)** — ang SSOT para sa lahat ng scoring logic (metrics, weights, tiers)
- **[Benchmark Specification](/docs/network/specifications/benchmark)** — evaluation protocol, corpus format, sovereignty
- **[Magsumite ng Method](/docs/network/getting-started/submit-a-method)** — step-by-step quickstart
- **[Leaderboard Rules](/docs/network/leaderboard/rules)** — submission criteria
- **[Data Stewardship](/docs/network/sovereignty/data-sovereignty)** — nananatili ang corpora sa kanilang stewards; iginagalang ang bawat license

