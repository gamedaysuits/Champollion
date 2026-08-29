---
title: "Matapat na mga Limitasyon"
description: "Ang hindi (pa) inaangkin ng Champollion. Ang mga nasusuring limitasyon sa aming evaluation, trust tiers, community validation, at held-out infrastructure."
---

# Matapat na mga Limitasyon

> Ito ang mga pahayag na **hindi** namin lalampasan. Kung may anumang nasa ibang bahagi ng
> site na ito na nagpapahiwatig ng higit pa kaysa sa nakasulat dito, ituring po ninyo iyon bilang bug at
> [ipaalam sa amin](/docs/network/perspectives/reporting-errors-and-owning-corrections).

Nakakakuha lamang ng tiwala ang evaluation infrastructure sa pagiging tapat tungkol sa mga hangganan nito. Narito
ang sa amin, ipinahayag nang sapat na malinaw upang masuri.

## 1. Kasalukuyang sumasaklaw lamang sa isang pares ang malalim na morphological validation

Ang FST-based morphological validation — pagsuri na ang bawat output word ay isang
well-formed word sa target language — ay sa praktika naka-wire para sa **English →
Plains Cree lamang**. Ang `GiellaLTFSTMetric` mismo ay **generic**: nagsi-score ito ng anumang
language na may published GiellaLT `.hfstol` analyzer (Plains Cree, ang Sámi
languages, Finnish, Norwegian Bokmål, Inuktitut, at iba pa), kaya malawak ang capability.
Ngunit **may evaluation corpora lamang para sa Plains Cree** sa kasalukuyan, kaya ang crk ang
tanging pares na FST-scored sa praktika. Ang bawat ibang pares sa
leaderboard ay sini-score gamit ang surface metrics (chrF++, BLEU) at behavioral checks.
Kapaki-pakinabang ang mga signal na iyon, ngunit **hindi** ginagarantiyahan ng mga ito ang morphological validity.
Hindi kami naghahayag ng morphological validation para sa anumang language nang walang parehong FST at
evaluation corpus.

## 2. Self-reported ang trust tiers sa launch

Karamihan sa mga score ay kinukuwenta ng mga contributor na sila mismo ang nagpapatakbo ng harness at
nagpa-publish ng resulta. Umiiral at lumalawak ang server-side **verification** — muling pag-score ng isang submission
laban sa SHA-pinned canonical corpus — ngunit
hindi pa pangkalahatan ang "verified". Basahin po ang trust badge sa bawat row: **ang "self-reported"
ay nangangahulugan mismo niyan**, at iyon ang default.

## 3. Hindi pa nangyayari ang community speaker-validation

Kinakailangan ng aming prize ang **≥ 70% acceptance mula sa bilingual speakers**. Nakatukoy na ang gate na iyon,
at ginagawa na ang tooling upang patakbuhin ito — ngunit **wala pang community
speaker review na naisagawa**, at **walang score sa site na ito ang nakapasa sa
speaker gate**. Ang composite at chrF++ numbers ay machine signals, hindi
community verdict.

## 4. Umiiral ang evaluation sandbox; wala pa ang custody ceremony nito

Kinukuha po namin ang mga corpora mula sa kanilang source at ginagawa ang SHA-pinning sa mga ito, at ang mga held-out split ay selyado. Kapag ang isang komunidad ay may hawak na sikretong test set, ang isang method ay maaaring ma-score laban dito nang hindi umaalis ang set sa kanilang mga kamay — at ang evaluation na iyon ay mayroon na pong **dalawang lane**. Ang mas pinipili po, para sa mga standard neural model, ay **declarative**: ang participant ay nagpapasa lamang ng data — safetensors weights + isang declarative tokenizer + isang config — at pinapatakbo ito ng organizer sa kanilang sariling trusted inference engine (`trust_remote_code=False`, offline; permissive tungkol sa architecture dahil ang kaligtasan ay nasa code-free format, hindi sa pangalan ng architecture). Wala pong tumatakbong participant code, kaya wala pong kailangang i-sandbox; ang safety check ay isang decidable format validation (ito ba ay safetensors at hindi isang pickle? walang `trust_remote_code`?), hindi isang pagtatangka na patunayan na ligtas ang arbitrary code. Para po sa mga method na talagang code (mga pipeline, LLM-coached hybrid), ang fallback ay ang network-isolated na **sandbox** (mga static check, `--network=none` container, scores-only egress, isang opsyonal na true-airgap file transport). Ang sandbox ay naglalaman ng untrusted code sa halip na tumangging patakbuhin ito, kaya ito po ang honestly-weaker lane — ang load-bearing guarantee nito ay `--network=none` (hindi kayang suriin ng isang heuristic static scan ang isang binary model), at ang mas malalim na hardening (seccomp, microVMs) ay ipinagpaliban. Tingnan po ang [run a sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest) para sa eksaktong detalye kung ano ang live at kung ano ang hindi. Ang **hindi** po binuo sa alinmang paraan: ang community-key-custodied side — threshold signing, key ceremonies, at node attestation. Ang authorization po ngayon ay isang recorded process (mga single custodian, single key, honestly labeled), kaya ang gold-standard na **prize** evaluation ay nananatiling sarado hanggang sa makahabol ang custody work at community consent.

## 5. Napagpasyahan na ang key custody; nasa confirmation ang community custodians

Napagpasyahan na ang custody *mechanism*: isang threshold/multisig scheme kung saan
**walang hawak na key shares ang Champollion**. Ang mismong custodians ay pinipili ng
mga komunidad, at nagpapatuloy ang mga pag-uusap na iyon — kaya sinasabi namin ang **"community
key custodians (in confirmation)."** Hindi consent ang custody: ang relational na
proseso ng community consent ay sarili nitong landas, mas mabagal, at mas mahalaga.

---

Gagalaw ang mga limitasyong ito kasabay ng pag-usad ng gawain. Kapag nagbago ang isa sa mga ito, magbabago rin ang page na ito
kasama nito — at dapat makita ang pagbabago sa page history, hindi
tahimik na alisin.

