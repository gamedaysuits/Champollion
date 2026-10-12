---
sidebar_position: 2
title: "Pagmamay-ari at Mga Tuntunin"
---

# Pagmamay-ari at Mga Tuntunin

> **Executive Summary.** Walang pangkalahatang kasunduan ang Champollion, ayon sa disenyo.
> Itinatakda ang mga tuntunin ayon sa bawat corpus, bawat wika, at bawat premyo ng tagapangasiwang nagmamay-ari
> ng data — ang tungkulin ng platform ay igalang anuman ang mga tuntuning iyon. Inilalarawan ng
> pahinang ito ang mga dimensyong sinasaklaw ng isang term sheet at ang **Community
> Transfer Template**, ang default na panimulang punto para sa mga naka-sponsor na premyo sa
> corpora ng mga wikang Katutubo.

## Ang balangkas ng mga tuntunin

Nilalayong maging flexible ang Champollion sa mga tuntunin nito upang ang lahat ng lisensiya ay
maigalang — at upang masuportahan nito ang mga bagong kaayusan: mga lihim na corpora,
mga test set na hawak ng komunidad, at mga kinakailangan para sa sovereign deployment. Magkakaroon ng magkakaibang
kasunduan ang iba't ibang wika. Maaaring lumahok ang isang CC0 corpus, isang community corpus
na para lamang sa pananaliksik, at isang selyadong gold-standard set na pinamamahalaan ng isang tribal council,
bawat isa ayon sa sarili nitong mga tuntunin.

Ang pare-pareho ay ang makinaryang gumagalang sa mga tuntuning iyon: exposure lanes,
license gates, quarantine, at fetch-from-source registration (tingnan ang
[Pagpaparehistro ng Corpora](/docs/network/sovereignty/registering-corpora)). Ang
*hindi kailanman* pare-pareho ay ang mismong kasunduan.

Kapag nagtatakda ng mga tuntunin ang isang corpus steward — para sa paglahok sa benchmark, para sa isang naka-sponsor
na premyo, o para sa anumang iba pa — sinasagot ng term sheet ang maliit na hanay ng mga tanong:

| Dimensyon | Ang tanong |
|---|---|
| **Corpus exposure** | Aling lane — public, research-only, o private? Ipinapakita ba kailanman ang mga reference? |
| **Method ownership** | Kung nanalo ang isang premyo, sino ang nagmamay-ari ng nanalong method — ang developer, ang komunidad, o shared? |
| **Deployment** | Sino ang maaaring mag-deploy ng method, saan, at sa ilalim ng anong mga kondisyon? |
| **Self-hosting** | Dapat bang tumakbo ang method nang buo sa imprastrakturang kontrolado ng komunidad? |
| **Secrecy** | Selyado ba ang test set? Sino ang may hawak ng mga susi? Sino ang nagpapahintulot sa bawat evaluation run? |
| **Compensation** | Magkano ang ibinabayad sa builders, validators, at reviewers? (Mga naka-publish na default: [Paano Binabayaran ang mga Tagapagsalita](/docs/network/perspectives/how-speakers-get-paid)) |

Wala sa mga ito ang may sagot na ipinapataw ng platform. Ang mga default sa ibaba ay template,
hindi tuntunin.

## Ang Community Transfer Template

Para sa mga naka-sponsor na premyo sa corpora ng mga wikang Katutubo, ang default na template —
inaalok bilang panimulang punto na maaaring baguhin ng governance body ng isang komunidad —
ay ganito gumagana:

### 1. Pagbuo ng method
Ang isang researcher, student, o developer ay bumubuo ng translation method — isang FST-gated
pipeline, isang coached LLM, isang fine-tuned model, o anumang ibang approach — gamit
ang sarili nilang resources at openly licensed data.

### 2. Network evaluation
Ang method ay bina-benchmark sa pamamagitan ng [eval harness](/docs/network/specifications/harness).
Ang bawat submission ay nilalagyan ng fingerprint sa isang partikular na Git commit at dataset version.
Reproducible ang mga score.

### 3. Community review
Sinusuri ang mga resulta ng community language workers. Pinatutunayan ng mataas na leaderboard score
na *gumagana* ang method; hindi nito pinatutunayan na ito ay *angkop*. Ang mga bilingual
speaker ay nagva-validate ng sample ng outputs, at maaaring tanggihan ng reviewers ng komunidad
ang isang method sa anumang dahilan.

### 4. Paglipat ng pagmamay-ari
Kapag natugunan ng isang method ang prize bar (automated metrics **at** human validation),
ilipat ng developer ang method — source code, trained weights,
configuration, coaching data — sa governance organization ng komunidad
(isang tribal council, language authority, o katulad na body na pinili ng komunidad,
hindi kailanman ng Champollion). Ganap na pagmamay-ari ng komunidad ang artifact: maaari nila itong
inspeksyunin, baguhin, i-deploy, ishelve, o lisensiyahan, nang walang patuloy na claim mula sa
developer o mula sa Champollion.

Ang mga third-party component na hindi pagmamay-ari ng developer (isang open-weight base model,
isang AGPL FST) ay hindi maaaring ilipat ang pagmamay-ari — ipinapasa ang mga ito sa
komunidad sa ilalim ng sarili nilang open licenses, kaya kinakailangan sa prize admissibility
na ang bawat dependency ay may dalang mga karapatang tunay na matatanggap ng komunidad.
Tingnan ang dependency classes sa
[Method Interface spec](/docs/network/specifications/methods#method-validity-and-dependency-classes).

Pinananatili ng developer ang dapat panatilihin ng mga researcher: ang walang limitasyong karapatang
i-publish ang approach at mga resulta, muling gamitin ang kanilang techniques kahit saan, at
permanenteng attribution bilang creator ng method.

### 5. Deployment — kung at paano pipiliin ng komunidad
Ang komunidad ang nagpapasya kung ide-deploy man ang method, kanino, at sa
anong mga tuntunin. Ang independent deployment ay ganap na usapin ng komunidad:
**Walang kinukuhang bahagi ang Champollion mula sa anumang kinikita ng isang komunidad mula sa asset na
pagmamay-ari nito**, at wala itong sariling deployment rights.

:::note[Katayuan: template, hindi track record]
Wala pang nabubuksang premyo at wala pang nagaganap na paglilipat — ang leaderboard
ay kasalukuyang walang nailathalang mga run. Nakadokumento ang template na ito upang maging malinaw ang nilalayong
mga tuntunin bago maglaan ng pagsisikap ang sinuman, at upang ang namamahalang
lupon ng isang komunidad ay magkaroon ng konkretong draft na matutugunan sa halip na blangkong pahina.
Ang isang nalagdaang instrumento, na binalangkas kasama ang counsel para sa mga partikular na partido, ang
magpapabisa sa alinman dito.
:::

## Para sa mga researcher

Kung kayo ay bumubuo ng method para sa isang wikang Katutubo:

1. **Magtatag muna ng ugnayan** sa language community bago kayo magsimula
2. **Gumamit ng openly licensed data** para sa development (hindi community-restricted resources)
3. **Idokumento ang provenance** sa inyong [run card](/docs/network/specifications/run-card) — bawat resource, ang lisensiya nito, at pinagmulan
4. **Basahin ang mga tuntunin ng premyo bago kayo bumuo para rito** — kung kasama sa mga tuntunin ang
   transfer, ang inyong contribution ay ang architecture at technique (sa inyo upang
   i-publish at muling gamitin); ang contribution ng komunidad ay ang linguistic knowledge
   na nagpapagana nito para sa kanilang wika

## Tingnan Din

- [Data Stewardship](/docs/network/sovereignty/data-sovereignty) — ang posisyong ipinapatupad ng mga tuntuning ito
- [Paano Pinopondohan ang Gawain](/docs/network/sovereignty/economic-model) — kung saan gumagalaw ang pera, at kung ano ang kinukuha ng Champollion (wala)
- [Pagpaparehistro ng Corpora](/docs/network/sovereignty/registering-corpora) — exposure lanes at fetch-from-source
- [Espesipikasyon ng Premyo](/docs/network/specifications/prizes) — threshold conditions at claim process
