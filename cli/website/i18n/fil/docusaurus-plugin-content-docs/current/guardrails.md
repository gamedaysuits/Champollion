---
title: "Ang mga guardrail"
slug: /guardrails
description: "Ang mga pagkakamaling tahimik na sumisira sa mga proyekto ng pagsasalin, at kung ano ang ginagawa ng mga rail sa bawat isa — sa payak na pananalita."
---

# Ang mga guardrail, isa-isa

Hindi malakas pumalpak ang karamihan sa mga proyekto ng pagsasalin. Tahimik silang nabibigo. Ang mga salitang ibinahagi nang may tiwala ay napupunta sa lugar na hindi dapat. Mukhang napakahusay ng isang tagasalin — dahil sinusubok ito sa mga pangungusap na nasaulo na nito. Ang isang mapalad na pagsubok ay nagmumukhang pag-unlad.

Pinipigilan ng bawat guardrail sa ibaba ang isa sa mga ito. Kusang ipinapatupad ng mga kagamitan ang karamihan sa mga ito; may ilan namang nakasalalay sa inyo at sa inyong assistant, at nakasaad ito sa bawat isa.

Isang salitang makikita ninyo sa ibaba: ang **score** ay isang numero para sa kung gaano kalapit ang mga pangungusap ng tagasalin sa paraan ng pagkakasabi ng isang tagapagsalita. Ang mas mataas na score ay nangangahulugang mas malapit.

## 1. Ang pag-alis ng inyong mga salita sa kanilang tahanan

**Ang nagiging problema.** Ang mga salitang ibinahagi nang may tiwala ay napupunta sa computer ng ibang tao, o sa loob ng AI ng ibang tao.

**Ang ginagawa ng mga rail.** Ang bawat file ay may kalakip na tala, na nakatabi mismo rito, na nagsasaad ng ipinasiya ng mga taong nagmamay-ari nito: maaari ba itong umalis kailanman sa computer na ito, at maaari bang matuto rito ang isang tagasalin. Sumusunod ang bawat kagamitan sa talang ito.

- Nagsisimulang pribado ang mga file, hanggang sa sumagot ang mga taong nagmamay-ari sa mga ito.
- Kapag sumagot na sila, maaari lamang gawing mas mahigpit ng mga kagamitan ang mga patakaran, ngunit hindi kailanman mas maluwag. Tao lamang ang maaaring magpaluwag sa mga ito, nang sinasadya at mano-mano. Kung may isang taong hindi pa natatanong na pumayag kalaunan, idinadagdag ang pagsang-ayong iyon.
- Walang mga salita ng sinuman ang ginagamit upang turuan ang isang tagasalin hanggang sa sabihin ng mga tao na pumayag ang mga tagapagsalitang iyon. Ang mga salita mula sa mga tagapagsalitang hindi pa sumasang-ayon, o tumanggi, ay hindi isinasama.
- Ang isang tagasaling natuto mula sa mga pribadong pangungusap ay itinuturing ding pribado, dahil maaari nitong ulitin ang natutuhan nito.
- Para sa mga file na nakatago sa computer na ito, mga bilang lamang ang ipinapakita ng mga kagamitan sa inyong AI assistant, hindi mga pangungusap.

**Ang nakasalalay sa inyo.** Karamihan sa mga AI assistant ay tumatakbo sa mga computer ng isang kompanya at ipinapadala ang anumang nababasa ng mga ito sa kompanyang iyon. Kung hihilingin ninyo sa isa na buksan ang inyong mga file, magagawa nito — walang kagamitang makakapigil doon. Para sa mga salitang nais ninyong manatiling pribado, gumamit ng assistant na tumatakbo sa sarili ninyong computer, o huwag hilingin dito na buksan ang mga ito. At hindi matutukoy ng mga kagamitan kung sino ang sumagot sa isang tanong, kaya dapat ang mga taong nagmamay-ari ng mga salita mismo ang sumagot para sa kanilang sarili. Ipinapakita sa [Inyong mga salita, inyong mga panuntunan](/docs/your-words-your-rules) ang buong paliwanag.

## 2. Ang pagsusulit na lihim palang takdang-aralin

**Ang nagiging problema.** Sinusubok ninyo ang isang tagasalin gamit ang mga pangungusap na pinag-aralan nito. Naaalala nito ang mga iyon at nagmumukhang napakatalino — ngunit pumapalpak sa anumang bago. Para itong pagbibigay ng marka sa isang mag-aaral gamit ang eksaktong mga tanong mula sa takdang-aralin kagabi.

**Ang ginagawa ng mga rail.** Bago ang anumang pagtuturo, nagbubukod kayo ng mga pansubok na pangungusap na sinuri ng isang mahusay na tagapagsalita. Minamarkahan ang mga ito upang walang tagasalin na matuto mula sa mga ito kailanman, at hindi isinasama ng mga kagamitan ang mga ito sa inilalabas ng mga ito maliban na lamang kung hihilingin ng isang tao na makita ang mga ito.

## 3. Mga halos magkatulad na kopya

**Ang nagiging problema.** Wala ang eksaktong pansubok na pangungusap sa mga pangungusap na natutuhan ng tagasalin — ngunit mayroon doong halos katulad nito. Sinusubok ang *"Papunta kami sa tindahan"*, at natutuhan naman ang *"Papunta na kami sa tindahan ngayon"*. Nabibigyan ng kredito ang tagasalin para sa memorya, hindi para sa pagsasalin.

**Ang ginagawa ng mga rail.** Bago magsimula ang pagtuturo, sinusuri ang bawat pangungusap na pag-aaralan ng tagasalin laban sa mga pansubok na pangungusap. Ibunubukod ang mga kopya at mga halos magkatulad na kopya. Ang mga pangungusap na may magkatulad lamang na padron ay pinapanatili ngunit binibilang, upang makita ninyo kung gaano kalaki ang posibleng maidulot ng mga ito para magmukhang mas maganda ang score kaysa sa totoo.

## 4. Pagsilip sa mga sagot

**Ang nagiging problema.** Suriin ang inyong tagasalin laban sa mga pansubok na pangungusap pagkatapos ng bawat maliit na pagbabago, at unti-unti ninyo itong naiaangkop sa mga pangungusap na iyon. Hindi na magsasabi ang pagsusulit ng anumang bago sa inyo.

**Ang ginagawa ng mga rail.** Ang araw-araw na pag-unlad ay hinahatulan batay sa isang hiwalay na hanay ng **mga pansanay na pangungusap**, na ibinukod mula sa inyong data. Sa bawat pagkakataong binibigyan ng score ng mga kagamitan sa pagsasanay ang mga pansubok na pangungusap, itinatala ito, at hindi magpapakita ang mga ito ng pansubok na score hangga't hindi naisusulat ang isang prediksiyon.

## 5. Pagpapasiya sa inyong inaasahan pagkatapos ninyong makita ang resulta

**Ang nagiging problema.** Kapag nasa screen na ang resulta, madaling sabihing *"humigit-kumulang iyon ang inasahan namin."* Sa gayon ay hindi na kayo magugulat ng resulta, at wala na itong maituturo sa inyo.

**Ang ginagawa ng mga rail.** Bago turuan ang unang tagasalin, isinusulat ng mga taong bumubuo nito ang kanilang inaasahan, sa sarili nilang mga salita. Hindi magpapatuloy ang mga rail hangga't hindi ito naisusulat, at kalaunan ay sinusuri ang resulta laban dito.

## 6. Pagkakamali sa suwerte bilang pag-unlad

**Ang nagiging problema.** Maaaring magkaiba nang kaunti ang score ng dalawang tagasalin dahil lamang sa tsamba, lalo na sa kakaunting bilang ng mga pangungusap. Ang isang mapalad na pagsubok ay nagmumukhang pag-unlad, at ang tunay na pagsulong ay maaaring maitago sa ingay.

**Ang ginagawa ng mga gabay.** Inihahambing ang isang bagong tagasalin sa ginagamit
ninyo, pangungusap sa bawat pangungusap, sa parehong mga pansanay na pangungusap.
Iaalok lamang ito sa inyo kung mas mataas ang marka nito nang higit sa karaniwang
maipapaliwanag ng suwerte — at kahit ganoon pa man, papalit lamang ito kapag sinabi
ninyong oo. Kung hindi, sasabihin ng mga tool ang *"walang masusukat na pagbabago"*
— at kung gaano kaliit na pagbuti ang masyadong maliit para makita sa ganoong
karaming pansanay na pangungusap. Kapag mas kaunti sa 50 pansanay na pangungusap,
walang markang makapagsasabi, kaya hindi talaga magpapasiya ang mga tool: sa halip,
ang mga marka ng tagapagsalita, sa mga borador mula sa dalawa nang hindi nalalaman
kung alin ang alin, ang magpapasiya.

## 7. Mas maganda ba ito kaysa sa isang diksiyonaryo?

**Ang nagiging problema.** Maliit lamang ang kahulugan ng isang score sa sarili nito. Maaaring hindi maging mas mahusay ang isang tagasalin kaysa sa paghahanap lamang ng bawat salita sa isang talaan ng mga salita.

**Ang ginagawa ng mga rail.** Kung mayroon kayong talaan ng mga salita, susukatin muna ng mga kagamitan kung gaano kalayo ang mararating ng paghahanap sa bawat salita. Sulit lamang gamitin ang isang tagasalin kung saan nahihigitan nito iyon.

## 8. Dalawang tagasaling nagtatago sa iisang score

**Ang nagiging problema.** Kapag hindi kayang hawakan ng isang tagasalin ang isang pangungusap, maaaring sumalo ang pangalawa at backup na tagasalin. Ayos lang iyon kapag ginagamit ninyo ito. Ngunit kung pinaghahalo ng isang pansubok na score ang dalawa, hindi ninyo matutukoy kung alin sa mga ito ang inyong sinukat.

**Ang ginagawa ng mga rail.** Ang isang pansubok na score ay laging nagmumula sa iisang tagasalin. Pinapayagan ang isang backup kapag ginagamit ninyo ang tagasalin, ngunit hindi kailanman kapag sinusukat ninyo ito.

## 9. Pagsasabi nang higit pa sa totoo

**Ang nagiging problema.** Masigasig na inihahayag ng isang assistant na *"handa na ang inyong tagasalin!"* kahit na halos hindi pa ito naturuan.

**Ang ginagawa ng mga rail.** Nagtatago ang mga kagamitan ng talaan ng kung ano ang talagang nangyari. Inaatasan ang inyong assistant na iulat lamang iyon, at ipasa ang bawat babala nang salita-sa-salita. Nakasalalay ito sa pagsunod ng assistant sa mga tagubilin nito.

---

Walang anuman dito ang nagpapahusay sa isang tagasalin. Tinitiyak lamang nito na lagi ninyong alam ang kalagayan nito — at ang mga taong nagmamay-ari ng wika ang mananatiling may kontrol.

**Susunod:** [Ang hindi pa nito kayang gawin →](/docs/what-it-cant-do-yet)

## Magbasa pa

- [Ang kontrata sa pagpapatakbo para sa mga AI agent](/docs/agents/contract) — bawat patakaran,
  at kung ipinapatupad ba ito ng mga kagamitan o ang assistant lamang ang makakasunod dito.
- [Bawat utos, hakbang-hakbang](/docs/agents/shell) — kung saan tumatakbo
  ang bawat pagsusuri, kasama ang mga eksaktong utos.
- Ang kahulugan ng "higit pa sa suwerte" rito: dapat mas mataas ang chrF++ ng bagong tagasalin sa
  hanay ng pagsasanay (dev) sa isang paired test at dapat manatiling higit sa zero ang interval nito.
  Pumili rin ang hanay ng pagsasanay ng pinakamahusay na checkpoint ng bagong tagasalin, na bahagyang
  pumapabor sa bago.
- [Pangangasiwa ng data](/docs/your-words-your-rules) — kung paano ginagamit
  ang data nang hindi ito isinusuko.
