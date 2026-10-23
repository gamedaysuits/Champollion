---
title: "Paggabay sa mga tao"
slug: /agents/coaching
description: "Kung paano inihahatid ng isang AI agent ang ulat ng round ng Champollion at nakikipag-usap sa mga taong bumubuo ng tagasalin: pag-unlad muna, bawat numero ay may kasamang yunit at set, pampalakas ng loob para lamang sa mga nasukat na pagbuti, paghingi ng oras nang walang pamimilit, at walang anumang ipinangangako tungkol sa kalidad."
---

# Paggabay sa komunidad

Sumusukat ang mga rail. Kayo ang naghahatid. Karamihan sa naririnig ng mga tao
tungkol sa kanilang tagasalin ay dumaraan sa inyo, kaya ang paraan ng inyong
pagsasabi ay bahagi ng gawain. Ang pahinang ito ay tungkol sa kung paano ito
sasabihin: kung ano ang nilalaman ng ulat ng yugto, paano ito ipapasa, paano
hihingi ng oras, at ang mga salitang dapat gamitin.

Ang mga pinagbabatayang panuntunan ay nasa [kontrata](/docs/agents/contract) §5:
sabihin lamang kung ano ang totoo, ipasa ang bawat paunawa nang buong-buo sa
bawat salita, ipangako ang proseso at kailanman ay huwag ang kalidad, ibigay sa
bawat numero ang yunit nito at ang pangkat kung saan ito sinukat.

## Ang ulat ng yugto

Nagtatapos ang bawat yugto ng pagpapahusay sa `champollion improve report` (ang hakbang
`improve-report` ng paglalakbay, mode `auto`). Isinusulat nito ang
`improve/round-<k>/report.json` at nagpi-print ng apat na bahagi; nagpi-print ang
`--json` ng kaparehong bagay:

| Field | Ano ang nilalaman nito |
|---|---|
| `round` | Ang kasalukuyang yugto: isa pagkatapos ng mga yugtong nahusgahan na ng forge |
| `progress` | Mga linya, ayon sa pagkakasunod-sunod: ang takbo sa mga marka ng tagapagsalita, pagkatapos ay ang mga marka ng bawat yugto (bawat isa ay sinusundan, sa isang yugto na ang sheet ay naghalo ng mga draft ng isa pang modelo, ng blind comparison), pagkatapos ay ang hatol ng bawat yugto sa dev set |
| `checks` | Mga babala tungkol sa kung ano ang kaya at hindi kayang ipakita ng mga numero |
| `projection` | Isang magaspang na pagtantiya kung gaano karami pang pangungusap sa pagsasanay ang aabot sa "gumagana", binibilang bawat pagdodoble sa mga ito, na may saklaw — o kung bakit walang ganoon — o `null` bago ang dalawang yugto ng mga marka |
| `projection_numbers` | Ang kaparehong pagtantiya bilang mga numero: `more_sentences`, `range` (`[fewest, most]` mga pangungusap sa pagsasanay; ang `most` ay `null` kapag hindi ito malimitahan ng mga pagsusuri) at `speaker_hours` — o `null` kapag walang pagtantiya |
| `actions` | Isa hanggang apat na mga bagay na susunod na gagawin |

Nagbabasa lamang ito ng mga talaang itinatago ng mga yugto — ang
`marks.json` ng tagapagsalita bawat yugto at ang mga hatol na
`improve-compare` ng forge — at nagpi-print ng mga bilang at porsyento,
kailanman ay hindi isang pangungusap.

### Ano ang ibig sabihin ng bawat linya

**Ang mga marka ng tagapagsalita — ang sukat na mahalaga.** Sa bawat yugto,
ginagawan ng draft ng ginagamit na modelo ang mga pangungusap na isinulat ng
pamilya, at minamarkahan ng tagapagsalita ang bawat draft bilang
`Y` (tama), `N` (mali, kalakip kung paano ito sinasabi)
o `?` (hindi sigurado). Ang bahaging tama ay binibilang mula sa mga
draft na minarkahang `Y` o `N`, na may 95% Wilson
interval:

> Yugto 1: minarkahan ng tagapagsalita ang 9 sa 24 na draft ng mga bagong
> pangungusap bilang tama — 38% (95% saklaw 21%–57%).

Ang mga ito ay mga bagong pangungusap — binalangkas bago natutuhan ng anumang modelo ang mga ito — kaya ito ang sukat na out-of-sample. Sa isang round kung saan ang sheet ay naghalo ng mga draft ng isa pang modelo, ang mga bilang na ito ay para lamang sa mga row ng kasalukuyang ginagamit na modelo. Ang mga row na muling ipinakita (sa ibaba) ay hindi kailanman kabilang sa mga ito.

**Mga row na muling ipinakita.** Mula sa round 2, humigit-kumulang isa sa bawat sampung row ay isang draft na minarkahan na ng nagsasalita sa isang naunang sheet, na ibinalik nang walang marka. Sinasabi ito ng sheet sa itaas nito — *"Kusang ibinalik ang ilang row sa ibaba mula sa mga naunang sheet. Mangyaring markahan ang mga ito nang panibago, na para bang bago: ipinapakita ng dalas ng pagtutugma ng mga marka kung gaano mapagkakatiwalaan ang mga ito."* — at hindi nito sinasabi kailanman kung alin. Ini-print ng `improve marks` ang *"Mga row na muling ipinakita: minarkahan ng nagsasalita ang A sa J tulad ng ginawa nila dati (P%)"*, kasama ang mga pagbaligtad sa bawat direksyon. Ang mga row na ito ay hindi kailanman ibinibilang sa bahagi ng round at hindi na muling sinasanay; kumukuha ang mga ito ng humigit-kumulang 10 segundo bawat row mula sa nagsasalita ([pagsukat](/docs/agents/measurement#the-speakers-marks)).

**Ang blind comparison.** Ang ikalawang modelo ay nagda-draft ng kalahati ng mga
draft ng isang sheet nang random, nang walang marka, at hinahatulan ng
tagapagsalita ang dalawa nang hindi nalalaman kung alin ang alin
([pagsukat](/docs/agents/measurement#the-speakers-marks)). Ang ikalawang modelo
ay ang pinakabago kapag hindi pa ito ginagamit; sa pagbisita pagkatapos ng isang
promosyon, ito ang modelong pinalitan ng bago. Nagdaragdag ang ulat ng isang
linya:

> Yugto 2: Blind, sa mga bagong pangungusap: ang ginagamit na modelo ay
> minarkahang tama sa 5 sa 12 (42%), ang mas bagong modelo (hindi ginagamit) sa
> 7 sa 12 (58%) — walang malinaw na pagkakaiba sa 24 na pangungusap.

Pagkatapos ng isang promosyon mababasa rito ang *"ang modelong huling ginamit ay
minarkahang tama sa …, ang modelong pinalitan nito sa …"*. Nagtatapos ito sa isa
sa tatlong paraan (isang two-proportion test sa 5%): para sa isang mas bagong
modelo, *ang mas bagong modelo ay malinaw na mas mahusay sa mga pangungusap na
kailangan ng pamilya* o *ang ginagamit na modelo ay malinaw na mas mahusay*;
pagkatapos ng isang promosyon, *ang bagong modelo ay malinaw na mas mahusay sa
mga pangungusap na kailangan ng pamilya* o *ang modelong pinalitan nito ay
malinaw na mas mahusay — ang bago ay hindi nakatulong sa mga pangungusap na
kailangan ng pamilya*; o *walang malinaw na pagkakaiba sa N na pangungusap*.
Kapag masyadong kakaunti ang minarkahang hilera ng isang modelo, sinasabi nitong
*"masyadong kakaunting hilera ng isang modelo ang nahusgahan upang
paghambingin"*.

**Ang takbo.** Tinatawag lamang ng ulat ang isang pagtaas bilang *tunay na
pagsulong* kapag natutugunan ang lahat ng tatlong ito:

- ang saklaw ng pinakahuling yugto ay ganap na mas mataas kaysa sa una (ang ibabang
  dulo nito ay mas mataas kaysa sa itaas na dulo ng una);
- may ginamit na modelo ng isang yugto sa pagitan — pinili ng komunidad
  (mga talaan ng `export` at `choose` ng forge): pagkatapos ng hatol na **better** at
  ng kanilang pag-oo, batay sa mga blind mark ng tagapagsalita, o sa sarili nilang pagpili. Ang
  hatol na **better** lamang ay hindi sapat; at
- sa pagmamarka nang blind sa parehong mga pagbisita, namarkahan ng tagapagsalita ang bagong modelo na tama
  nang mas madalas kaysa sa pinalitan nito (ang mga pagsusuri pagkatapos ng bawat
  promosyon, pinagsama-sama; isang two-proportion test sa 5%).

Nariyan ang ikatlo dahil maaaring magbago ang pagmamarka ng tagapagsalita: ang isang nagiging
mas mabait sa bawat round ay nagtataas ng bawat bahagdan, ngunit sa isang pagbisita ay pareho nitong naaapektuhan
ang dalawang modelo. Sa isang simulasyon na may tagapagsalitang nagmamarka sa 10% ng mga draft nang mali at
nagiging mas mabait sa bawat round, ang isang promosyong nagkamali ang practice set nang nagkataon
ay nabasa bilang tunay na pag-unlad sa 106 sa 1,600 ulat kung saan hindi makapagpapahusay
ang modelo; sa tulong ng blind check, 3 lamang — at hindi hihigit sa 3 sa 1,600 muli kapag muling pinatakbo
nang may 50-pangungusap na floor at ang hatol ng tagapagsalita, kabilang ang mga pagpapatakbo na ang
practice set ay nagsisimula sa 30 pangungusap.

Ang pagtaas na may promosyon ngunit walang pagsusuring iyon ay ipiniprint bilang
*hindi pa ibinibilang bilang tunay na pagsulong: maaaring nagbago rin ang bait sa
pagmamarka sa mga draft* — kalakip ang mga bilang ng pagsusuri, o sinasabing ang
susunod na sheet ay maghahalohalo ng mga draft ng dalawang modelo. Ang pagtaas
gamit ang kaparehong ginagamit na modelo ay ipiniprint bilang *hindi ibinibilang
bilang pagsulong*: ang mga pangungusap o ang pagmamarka ang nagbago, hindi ang
modelo. Ang pagtaas sa loob ng mga saklaw ay ipiniprint bilang *tumaas, bagaman
hindi pa lumalagpas sa kawalan ng katiyakan*.

**Ang hatol ng dev-set.** Pinaghahambing ng forge ang bagong modelo sa ginagamit
na modelo sa parehong mga pangungusap ng dev (pagsasanay), pangungusap bawat
pangungusap:

> Round 1: sa parehong 50 pangungusap sa pagsasanay (dev), chrF++ (0–100, overlap
> sa nasuring salin) 24.1 para sa bagong modelo laban sa 22.0 para sa
> modelong ginagamit — walang masusukat na pagbabago: hindi ginamit (sa 50 pangungusap, pagkakaiba
> lamang na humigit-kumulang 5.8 puntos o higit pa ang mapagkakatiwalaang lumilitaw).

Ang pagtatapos ng linya ay nakasalalay sa hatol at kung pinili ba ng komunidad
ang modelo ng yugto (mga talaan ng `export` at `choose` ng forge) — walang ginagamit
ang isang hatol lamang:

| Hatol | Hindi pinili | Pinili |
|---|---|---|
| **better** | *masusukat na mas mahusay: hindi ginamit — hindi pa ito pinipili ng komunidad* | *masusukat na mas mahusay: ginamit* |
| **worse** | *masusukat na mas masahol: hindi ginamit* | *masusukat na mas masahol — ginamit …* |
| **no-change** | *walang masusukat na pagbabago: hindi ginamit* | *walang masusukat na pagbabago — ginamit …* |
| **too-few** | *napakakaunting pangungusap para sa pagsasanay upang matukoy (mababa sa 50): ang mga blind mark ng tagapagsalita ang magpapasya* | *napakakaunting pangungusap para sa pagsasanay upang matukoy (mababa sa 50) — ginamit …* |

Nagtatapos ang "Ginamit …" sa *batay sa mga blind mark ng tagapagsalita* kapag may hawak ang forge na
hatol ng tagapagsalita para sa modelong iyon na may `clear: newer` (`improve-speaker`), at
*sa sariling pagpili ng komunidad* kung hindi. Gumagamit ang `champollion improve status` ng
parehong mga salita: nagtatapos ang linya ng bawat yugto sa *"· bagong modelo sa mga pangungusap para sa pagsasanay (dev): …"*. Ang tuntunin sa paghatol ay nasa
[pagsukat](/docs/agents/measurement#comparing-two-models).

**Ang mga pagsusuri.**

- *Overfitting.* Kung ang dev chrF++ ng ginagamit na modelo ay tumaas nang 3 puntos o higit pa sa kabuuan ng mga round (mabibilang lamang ang bagong modelo ng huling round kapag pinili na ito ng mga tao) habang ang bahagi ng tama ng nagsasalita ay tumaas nang 2 puntos o mas mababa pa, sinasabi ng ulat na ang pagtaas ay maaaring dulot ng mga pangungusap sa pagsasanay, at dapat pagkatiwalaan ang mga marka.
- *Masyadong maliit na dev set upang makakita ng pagtaas.* Kapag ang pinakamaliit na pagkakaibang mapagkakatiwalaang naipapakita ng dev set ay higit sa 3 puntos ng chrF++ (o, kung hindi alam, wala pang 50 pangungusap), sinasabi ng ulat na ang "walang nasusukat na pagbabago" ay limitasyon ng dev set, hindi patunay na walang nagawa ang round.
- *Kung gaano mapagkakatiwalaan ang mga marka.* Kapag nahusgahan na ang 10 row na muling ipinakita, sa lahat ng round: *"Minarkahan ng nagsasalita ang A sa J na mga row na muling ipinakita tulad ng ginawa nila dati (P%): humigit-kumulang E% ng mga marka ang napupunta sa kabilang direksyon nang random, na humihila sa bawat bahagi na minarkahang tama patungong 50% — isinasaalang-alang ito ng proyeksyon."* Kapag ang mga draft na dating mali na ngayo'y minarkahang tama ay malinaw na mas marami kaysa sa kabaligtaran (isang sign test sa 5%, 6 na pagbaligtad o higit pa), idinadagdag nito na *"maaaring nagiging mas mabait ang pagmamarka, na hindi maipapakita ng pagtaas sa bahagi"*. Bago ang 10: *"N na row na muling ipinakita ang nahusgahan sa ngayon — ang sariling error sa pagmamarka ng nagsasalita ay tinatantya mula sa 10."*

**Ang proyeksyon.** Ginagawa lamang kapag ang pagtaas ay tunay na pag-unlad (lahat ng tatlo sa itaas) at ang bahagi ng tama ay mas mababa pa rin sa 80% — ang salita ng rails para sa *gumagana* sa mga pangungusap na kailangan ng pamilya. Tumataas ang mga learning curve sa halos magkakapantay na mga hakbang bawat pagdodoble ng mga pangungusap sa pagsasanay, kaya binabasa nito ang hakbang mula sa mga blind check ng nagsasalita sa bawat bagong modelo laban sa pinalitan nito (nakatala ang mga pares sa pagsasanay ng dalawang modelo) at sinasabi kung gaano karami pang mga pangungusap sa pagsasanay ang aabot sa 80% na minarkahang tama, kalakip ang isang saklaw, at ang mga oras ng nagsasalita sa humigit-kumulang 70 segundo bawat pangungusap (isang minuto para isulat, sampung segundo para markahan). Sinasaklaw ng saklaw ang pinapahintulutan ng mga pagsusuri (95%) at, kapag nahusgahan na ang 10 row na muling ipinakita, kung saan maaaring pumatak ang "tunay na tama sa 80%" batay sa sariling mga marka ng nagsasalitang ito; pagkatapos ay sinasabi ng teksto na *"ang mga draft na tunay na tama sa 80% ay maaaring mamarkahang tama nang humigit-kumulang T% ng oras batay sa kanilang mga marka — isinasama iyon ng saklaw"*. Bago iyon, sinasabi nito na *"(Hindi pa isinasaalang-alang ang sariling error sa pagmamarka ng nagsasalita: napakakaunting mga row na muling ipinakita ang nahusgahan.)"* Ang pagtataya mismo ay nananatili sa payak na 80%. Ang mga bilang ay ibinibilog sa dalawang numero. Kapag hindi ito malimitahan ng mga pagsusuri, sinasabi nito na *"hindi pa masasabi kung gaano pa karami ang maaaring kailanganin"*. Kung hindi, sinasabi nito kung bakit wala — halimbawa, *"hindi pa naipapakita ng blind check ng nagsasalita na tinatalo ng bagong modelo ang pinalitan nito, kaya maaaring ang pagtaas ay nasa pagmamarka, hindi sa modelo"*. Palaging sabihing isa lamang itong magaspang na pagtataya; ganoon ang ginagawa ng ulat. Sa simulasyon, pumatak ito sa loob ng factor na 2 ng totoong bilang nang 69–78% ng oras sa 400 pangungusap bawat round at 53–56% sa 800, at ang totoong bilang ay pumatak sa loob ng saklaw nang 89–94% at 76–80% ng oras (sa 800 bawat round, 51–54% bago isama ng saklaw ang mga marka ng nagsasalita); ang tuwid na linyang pinalitan nito, 5% sa 400. Huwag kailanman sabihing ang isang modelo ay "maaaring gumagana na" batay sa error sa pagmamarka ng nagsasalita: hindi ito ginagawa ng ulat, dahil sa simulasyon ang talang iyon ay mali nang 2–3 beses sa bawat beses na tama ito.

**Ang mga aksyon.** Ayon sa prayoridad, hindi hihigit sa apat: markahan ang sheet ng round na ito, o isulat
ang mga pangungusap na kulang pa (20 bawat round); kapag natuklasan ng blind na paghahambing na
malinaw na mas mahusay ang mas bagong modelo, na *"nakatulong nga ang round, kahit saan hindi ito naipakita ng
practice set"* — magpatuloy, at ang pagpapalaki ng practice set ay magbibigay-daan upang makita ito ng susunod
na hatol; kapag minarkahan ng tagapagsalita ang modelong pinalitan ng isang promosyon bilang malinaw na mas mahusay, tanungin ang mga tao kung ibabalik ang naunang modelo, at gawing mas katulad ng mga pangungusap na kailangan nila ang practice set; palakihin
ang practice set, kapag ito ay masyadong maliit upang makita ang pagsulong ng isang round at mas mababa sa 200
pangungusap (*"ang isang pangungusap sa bawat 2 sa bawat sheet ay walang draft — isinusulat ng tagapagsalita
kung paano ito sinasabi, at sumasama ito sa practice set (ngayon ay 31; ang 50 ay nagbibigay-daan upang mahusgahan ang isang
round, ang 200 ay nagpapakita ng pagtaas na humigit-kumulang 3 puntos)"* — "sa bawat 4"
mula sa 50); kung ano ang gagawin pagkatapos ng dalawang round na walang pagsulong (sa ibaba); na
ang oras na sinabi ng tagapagsalita na kaya nilang ibigay ay tila masyadong kaunti; at, kapag ang ibabang
dulo ng bahagdan ng tama ay umabot sa 70%, isang pagsusuri sa naka-lock na test set — na may
nakasulat na hula muna.

**Dalawang yugto nang walang nakuha** — parehong **no-change** o
**worse** ang huling dalawang hatol (ang yugtong **too-few** ay walang sinasabi sa alinmang paraan, at hindi binibilang),
nang walang modelong ginamit sa pagitan ng mga ito; pareho ang pagbibilang ng forge para sa
alok na mas malakas na modelo. Kung saan nakikita ng practice set ang karaniwang nakuha ng isang yugto,
mababasa sa aksyon ang *"Dalawang yugto nang walang nakuhang makikita ng practice set na ito
(mga X puntos ng chrF++ o higit pa): maaaring mas mababa pa roon ang idinadagdag ng mga yugto, o
wala — hindi nito matukoy kung alin. Mas mabilis na mga paraan pasulong: ang mas malakas na modelong
inaalok ng mga rail kapag kayang magsanay ng computer ng isa, o higit pa sa mga uri ng pangungusap
na mali ang nagagawa nito."* (Ang X ay ang pinakamaliit na pagkakaibang ipinapakita ng hatol.) Kung saan
hindi nito kaya, sinasabi nitong magpatuloy lang. Huwag kailanman sabihin o ipahiwatig na hindi makatutulong
ang higit pang mga pangungusap: malapit sa tuktok ng curve, nagdaragdag ang isang yugto ng humigit-kumulang kalahating puntos ng chrF++, mas mababa
sa kayang ipakita ng 200 pangungusap sa pagsasanay. Sa mga simulate na yugto, ang lumang linyang
"maaaring hindi makatulong ang higit pa sa pareho" ay nasabi sa 98 sa 1,200 ulat habang
talagang bumubuti ang modelo.

### Paano ito ipapasa

1. **Pag-unlad muna.** Simulan sa kung ano ang nagbago, sa mga marka ng tagapagsalita.
2. **Bawat numero kasama ang yunit at set nito.** "9 sa 24 na bagong pangungusap na
   sinuri ng tagapagsalita ay tama — 38%", huwag kailanman "38%". "chrF++ 24.1 mula sa 100 sa
   50 pangungusap sa pagsasanay", huwag kailanman "24.1". Ang saklaw ay kung gaano katiyak ang mga tool,
   hindi dalawang resulta: "sa pagitan ng 21% at 57% — sa 24 na pangungusap, hindi
   mas magiging tiyak ang mga tool kaysa roon".
3. **Ang mga pagsusuri, nang payak.** Kung nagbabala ang ulat, sabihin kung ano ang ibinababala nito.
4. **Ang mga susunod na hakbang bilang mga bagay na maaari nilang gawin.** Gawing isang pangungusap ang bawat aksyon
   na nakatuon sa mga tao, kasama ang file na binabanggit nito.
5. **Ipasa ang bawat babala nang salita-sa-salita.**

**Himukin ang anumang nasusukat.** Isang draft na minarkahang tama, isang pagtaas
na lampas sa mga saklaw, isang bagong modelong ginamit: sabihin ito nang buong
init. Ang unang salin ay nararapat ipagdiwang. Huwag kailanman ipagdiwang ang
isang numerong hindi tinatawag ng ulat na pagsulong.

**"Walang masusukat na pagbabago" — nang payak at may kabaitan.** Hindi nito
ibig sabihing nasayang ang yugto. Sabihin kung ano ang ibig sabihin nito: sa
ganito karaming pangungusap sa pagsasanay, ang pagkakaiba lamang na
humigit-kumulang ganito ang laki ang lumalabas; maaaring may nakatagong mas
maliit na pakinabang; mananatiling ginagamit ang kasalukuyang modelo; may halaga
pa rin ang mga pangungusap na inayos ng tagapagsalita. Pagkatapos ay sabihin ang
susunod na hakbang.

**"Masyadong kakaunti ang mga pangungusap sa pagsasanay para masabi" — hindi "walang pagbabago".** Kapag wala pang 50
pangungusap sa pagsasanay, walang paghahambing na makapagpapasya, anuman ang dalawang marka; hindi ito
isang hatol tungkol sa bagong modelo. Sabihin kung ano ang mangyayari sa halip: ang modelong ginagamit
ang mananatili muna; ihahalo sa susunod na sheet ang mga draft ng mas bagong modelo, nang walang marka,
at ang mga marka ng tagapagsalita ang magpapasya; isa sa bawat dalawang hilera ng sheet ay walang draft, at ang mga
pangungusap na iyon ang magpapalaki sa practice set hanggang sa maaari nang mahusgahan ang isang round batay rito.

**Ang blind na paghahambing — kasama ang dalawang bilang, at kung ano ang ginagawa nito.** Sabihin
ang mga bilang ng dalawang modelo at ang pagtatapos ng ulat, tulad ng nakasulat. Kapag ang mas bagong modelo
ay malinaw na mas mahusay, sabihin ito tulad ng ginagawa ng ulat — nakatulong nga ang round, kahit na
hindi ito naipakita ng practice set — at na ito ay sariling pagpapasiya ng tagapagsalita sa mga bagong pangungusap. Pagkatapos ng hatol na **too-few** o **no-change** sa
modelong iyon, dahil sa isang malinaw na kagustuhan ay iaalok ito ng forge para magamit: ini-print ng `improve marks`
ang *"naitala ito ng forge: nag-aalok itong gamitin ang mas bagong modelo (pumayag muna ang
mga tao)"*, at dumarating ang alok bilang hakbang na `improve-promote`
(sa ibaba) — magtanong bago ito patakbuhin. Pagkatapos ng hatol na **worse**, hindi ito
iaalok. Pagkatapos ng promosyon, ang parehong pagsusuri ang nagpapahintulot sa ulat na ituring ang
pagtaas bilang tunay na pag-unlad; kapag sinasabi nitong ang modelong pinalitan nito ay malinaw na
mas mahusay, tanungin ang mga tao kung ibabalik ang naunang modelo — huwag kailanman gawin ito
nang wala ang kanilang pagsang-ayon. Ang "Walang malinaw na pagkakaiba" sa 24 na pangungusap ay nangangahulugan ng sinasabi nito.
**Paalala.** Huwag kailanman sabihin sa tagapagsalita kung aling mga hilera ang nagmula sa aling modelo bago
mabasa ang kanilang mga marka.

**Mga row na muling ipinakita — para saan ang mga ito.** Sabihin ang pagtutugma kasama ang mga bilang nito, tulad ng ginagawa ng ulat ("minarkahan ng nagsasalita ang 17 sa 20 row na muling ipinakita tulad ng ginawa nila dati — 85%"), at kung para saan ito: kung gaano mapagkakatiwalaan ang mga marka. Inihahayag ito sa sheet, hindi ito isang nakatagong pagsusuri sa nagsasalita. Sabihin ang random error tulad ng ginagawa ng ulat: humigit-kumulang E% ng mga marka ang napupunta sa kabilang direksyon nang random, na humihila sa bawat bahagi patungong 50%, at isinasaalang-alang ito ng proyeksyon. Kapag sinabi ng ulat na *"maaaring nagiging mas mabait ang pagmamarka"*, sabihin ito nang payak at walang paninisi: ang pagtaas sa bahagi ay maaaring dahil sa pagmamarka, hindi sa modelo. **Paalala.** Huwag kailanman sasabihin sa nagsasalita kung aling mga row ang nagbabalik, o kung ano ang minarkahan nila dati — sinasabi lamang ng sheet na may ilang row na nagbabalik.

**Mga salitang hindi kailanman nakita ng modelo.** Kapag nagbabala ang
`sync` na ang mga susi ay *"naglalaman ng mga salitang hindi kailanman
nakita ng modelo sa pagsasanay — malamang na mali ang salin, gaano man ito
kamatatas"*, sabihin ito nang payak: ang mga linyang iyon ay malamang na mali
kahit maganda itong basahin; dapat itong suriin ng isang tagapagsalita, o
maaaring ituro ang mga salitang iyon sa mga pangungusap ng susunod na yugto.
Pangalanan ang mga susi, ayon sa ginagawa ng babala; hindi ninyo kailanman
nakikita ang mga salita. Nakikita ito ng tao sa try page ng modelo, sa ilalim ng
bawat linya. Ang katibayan, sa inimbentong wikang pansubok: ang mga pangungusap
na naglalaman ng salitang hindi nakita ng modelo ay naging tama nang 0 beses sa
358 ([pagse-serve](/docs/agents/serving#words-the-model-never-saw)).

**Ang mga salita ng wishlist.** Humihiling ang seksyong "Mga salitang hindi pa
nito nakita" nito ng *"dalawa o tatlong pangungusap kalakip ang bawat salitang
kailangan ninyo, na bawat isa ay may ibang sinasabi"*: mas kaunting mga salita,
na bawat isa ay nasa ilang pangungusap, ang nagtuturo nang higit sa modelo kaysa
sa maraming salita nang minsan lamang. Ipasa ito sa ganoong paraan. Sa
inimbentong wikang pansubok, ang isang salitang nakita nang minsan sa pagsasanay
ay naging tama nang 27–29% ng oras, at kapag nakita nang 2–4 na beses ay 63–95%;
at sa 3,200 pangungusap sa pagsasanay, ang ByT5-small na sinanay sa mga
pangungusap na pinili para sa pinakamaraming bagong salita ay may 39.4% ng 500
itinabing pangungusap na tama ang kahulugan, laban sa 53.4% para sa mga
pang-araw-araw na pangungusap — sa bahagyang mas maraming oras ng tagapagsalita
(mga 57 oras laban sa 54).

Huwag kailanman tawaging mabuti o masama ang isang marka sa sarili ninyo. Isang
matatas na tagapagsalita ang nagpapasya kung ano ang angkop na gamitin.

## Paghingi ng oras

Nagtatanong ang hakbang na `improve-time` (mode `ask_user`) kung gaano
karaming oras ang maibibigay ng tagapagsalita: `per_week` at
`total`, bawat isa ay **eksakto sa sinabi nila** ("marahil 30
pangungusap sa isang linggo", "ilang oras, tapos titingnan natin"). Itinatala
ito ng `champollion improve time` sa `improve/time.json`; ang bilang ng pangungusap sa bawat
yugto ay pinaplano batay rito, at inihahambing ng ulat ang pagtantiya rito.

- **Tandaan.** Magtanong nang minsan lamang; huwag kailanman mamilit para sa higit
  pa. Kung hindi nila alam, ipasa ang sinabi nila — ang malalabong salita ay isa
  ring sagot.
- **Tandaan.** Kapag sinabi ng ulat na kailangan sa pagtantiya ng mas maraming
  pangungusap kaysa sa natitirang oras na sinabi nila, sabihin ito sa kanila nang
  payak, kalakip ang mga opsyon na binabanggit nito: mas marami pang
  tagapagsalita, mga katulong sa proyekto, o pansamantalang mas makitid na
  layunin (isang phrasebook para sa mga pangungusap na pinakakailangan nila).
  Pagkatapos ay hayaan silang pumili.

## Ang mga alok ng mga rail

**Pag-aalok ng mas mahusay na modelo para magamit** (estado ng forge na `improve-promote`, mode na
`confirm`). Masusukat na mas mahusay ang isang bagong modelo sa dev set — o hindi
makapagpasya ang dev set (**too-few**, o **no-change**) at minarkahan itong tama ng tagapagsalita,
nang blind, nang mas madalas. Pagkatapos ay idinaragdag ng `why` ng forge ang
mga bilang ng tagapagsalita: *"Sa pagmamarka nang blind sa parehong pagbisita, minarkahan ng tagapagsalita ang
mas bagong modelo na tama sa A ng B bagong pangungusap (P%) at ang modelong ginagamit sa C ng
D (Q%) — isang malinaw na pagkakaiba: mas mahusay ang mas bagong modelo sa mga pangungusap na
kailangan ng pamilya."* Sabihin kung alin iyon. Isa itong alok: walang binabago ang isang hatol
lamang. Binabago ng paggamit nito ang isinasagot ng kanilang pahina o app, kaya magtanong bago
patakbuhin ang hakbang; sa "hindi muna ngayon", `declined: true`. Ang kanilang pag-oo lamang — ang
`export` at `choose` ng hakbang — ang nagpapasimula sa paggamit nito; hanggang sa panahong iyon ay mababasa sa ulat
ang *"masusukat na mas mahusay: hindi ginamit — hindi pa ito pinipili ng komunidad"*, at
walang pagtaas na mabibilang bilang pagsulong mula rito. Kapag napili na batay sa mga marka ng tagapagsalita, mababasa
sa linya ng yugto ang *"ginamit batay sa mga blind mark ng tagapagsalita"*.

**Isang mas malakas na modelo** (estado ng forge na `improve-stronger-model`, mode na `ask_user`).
Pagkatapos ng dalawang magkasunod na yugto na nahusgahan ng dev set na walang ipinakitang nakuha —
parehong **no-change** o **worse**; hindi binibilang ang yugtong **too-few** —
binibilang mula sa huling pagpapalit ng modelo (isang pagpapalit ng preset, o anumang modelong
ginamit ng komunidad gamit ang `choose`, kasama ang promosyon batay sa mga marka ng tagapagsalita),
habang ginagamit ang napakaliit na modelo, inaalok ng mga rail ang ByT5-small
— `byt5-small`, o `byt5-small-lowmem` kung saan may 8–15 GB ng memory ang GPU
para magsanay (mas kaunting memory bawat hakbang, mas mabagal): isang pag-download na humigit-kumulang 1.2 GB at
mas mahabang pagsasanay, pinakamainam sa Apple silicon o isang NVIDIA GPU
([pagsasanay](/docs/agents/training#models)). Ang puwang para sa sagot ay `try_it`:
`yes` o `not-now`. Sabihin kung ano ang sinasabi ng `why` ng forge — kapag napakaliit
ng dev set upang makita ang nakuha ng isang yugto, sabihing maaaring nakatago ang maliliit na nakuha; kung hindi, na
nagdulot ang dalawang yugto ng *"walang pagbabagong makikita ng mga dev na pangungusap (mga X puntos ng chrF++
o higit pa): maaaring mas mababa pa roon ang idinadagdag ng mga yugto, o wala"*. Hindi
nito sinasabing hindi nakatutulong ang higit pang mga pangungusap, at ganoon din po kayo. Ang "Hindi muna ngayon"
ay isa sa mga sagot sa hakbang na ito: ipasa ang `try_it: "not-now"` (sa MCP,
tinatanggihan dito ang `declined: true`). Itinatala ito ng Forge, pinananatili ang modelong ginagamit,
at babalik lamang ang alok pagkatapos ng dalawa pang ganoong yugto (**no-change** o
**worse**). Maayos ang alinmang sagot; sa kanila ito.

**Paghusga sa hula.** Pagkatapos ng marka sa test-set, sinasabi ng mga tao kung
nagkatotoo ang hulang isinulat nila (`held` o `missed`) at kung
sino ang humatol dito. Basahin sa kanila ang hula at ang marka kalakip ang
saklaw nito; huwag kailanman husgahan ito para sa kanila.

**Mga tagapagsalitang hindi pa sumasang-ayon.** Ang isang file sa
`waiting_for_agreement` ay itinatanong nang minsan bawat session, nang may pag-iingat at
kabaitan. Tanging ang oo mula sa tao — na ang bawat isa na ang mga salita ay
naroroon ay sumang-ayon — ang sumasagot dito.

## Mga salita para sa komunidad

| Sabihin | Sa halip na |
|---|---|
| "isang marka mula sa 100 para sa kung gaano kalapit ang mga salin sa sariling gawa ng tagapagsalita — chrF++" | "chrF++ 24.1" lamang |
| "kung gaano katiyak ang mga tool: sa pagitan ng 21% at 57%" | "CI [0.21, 0.57]" |
| "ang mga pangungusap sa pagsasanay" (ang dev set) | "dev split" |
| "ang mga pansubok na pangungusap, na pinananatiling naka-lock" | "held-out test set" |
| "ang unang maliit na modelo" | ang pangalan ng folder o run nito |
| "walang masusukat na pagbabago — sa 50 pangungusap sa pagsasanay, pagkakaiba lamang na humigit-kumulang 6 na puntos ang lumilitaw" | "walang pagpapahusay" |
| "masyadong kakaunti ang mga pangungusap sa pagsasanay para masabi pa sa ngayon — kapag wala pang 50, ang sariling mga marka ng tagapagsalita ang magpapasya" | "walang pagbabago" para sa isang hatol na too-few |
| "isang phrasebook: mahusay sa mga pangungusap na katulad ng mga natutuhan nito" | "low-resource NMT baseline" |
| "minarkahan ng tagapagsalita ang 9 sa 24 bilang tama" | "accuracy 38%" |

Ipaliwanag ang isang termino sa unang pagkakataon na lumitaw ito, na may halimbawa
bago ang mismong salita.

## Kailan magmumungkahi ng tulong

- **Nakahinto ang proyekto, o humihingi sila ng tulong mula sa mga tao.**
  Sabihin: *"Nagkakaproblema ba, o nais ng tulong sa inyong proyekto? Mag-usap
  tayo."* — [info@champollion.dev](mailto:info@champollion.dev). Kailanman ay
  hindi sapilitan; walang bayad.
- **Kailangan nila ng higit pang pangungusap, tagapagsalita o computing kaysa sa
  mayroon sila.** Ituro sila sa [Sumali sa isang proyekto](/docs/join-a-project):
  ang iba ay maaaring mag-alok ng mga pangungusap, talaan ng mga salita o mga
  pamamaraan (mga file lamang sa ngayon), at walang anuman sa kanila ang lalabas
  nang walang pagsang-ayon nila ([pag-host at pagsali](/docs/agents/hosting-and-joining)).

## Magbasa pa

- [Pahusayin ito, yugto-bawat-yugto](/docs/make-it-better) — ang improve loop
  ayon sa pagbasa ng komunidad.
- [Mga panuntunan sa pagsukat](/docs/agents/measurement) — ang panuntunan sa
  paghatol, mga saklaw at mga limitasyon ng dev-set.
- [Pagsasanay gamit ang nmt-forge](/docs/agents/training) — kung ano ang mas
  malakas na modelo at ang halaga nito.
- [Ang kontrata sa pagpapatakbo](/docs/agents/contract) §5 — sabihin lamang kung
  ano ang totoo.
