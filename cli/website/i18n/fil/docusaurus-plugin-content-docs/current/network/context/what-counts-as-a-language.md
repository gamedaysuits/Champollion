---
sidebar_position: 2
title: "Ano ang Itinuturing na Wika Dito?"
---

# Ano ang Maituturing na Wika Dito?

> **Buod.** Ikinakatalogo ng Network ang mga wika ayon sa ISO 639-3, nagbe-benchmark ng mga indibidwal na wika (hindi ng mga payong na macrolanguage), isinasama ang mga wikang pasenyas bilang mga likas na wikang talaga ang mga ito, isinasama ang mga constructed language na kinikilala ng ISO, hindi isinasama ang mga programming language, at ipinapakita ang mga pagtatalo sa taxonomy nang hindi pumapanig. Ipinapaliwanag ng pahinang ito ang bawat pasya at kung ano ang ibig sabihin nito para sa leaderboard.

Kailangang sagutin ng anumang proyektong nagbe-benchmark ng pagsasalin sa libo-libong wika ang isang luma at nakakagulat na mahirap na tanong: ano ang maituturing na wika? Matagal nang alam ng mga lingguwista na ang hangganan sa pagitan ng "wika" at "dialect" ay kasing-sosyal at kasing-politikal ng pagiging estruktural nito — ang kilalang biro na *"ang isang wika ay isang dialect na may hukbo at hukbong-dagat"* ay pinasikat ng Yiddish linguist na si Max Weinreich noong 1945 (inugnay niya ito sa isang tagapakinig sa isa sa kanyang mga lecture). Hindi namin maaaring iwasan ang tanong, kaya narito ang aming mga sagot, at ang aming pangangatwiran.

---

## Ang mga wikang pasenyas ay mga wika. Walang pasubali.

Ang mga wikang pasenyas ay mga likas na wika — may kumpletong grammar, katutubong pagkatuto ng mga bata, at mga buhay na komunidad ng wika. Matagal na itong napagtibay sa linguistics mula noong ipinakita ni William Stokoe noong 1960 na ang American Sign Language ay may parehong uri ng panloob na estruktura gaya ng mga wikang pasalita, at animnapung taon ng pananaliksik mula noon (Klima & Bellugi 1979; Sandler & Lillo-Martin 2006) ay lalo lamang nagpatibay sa puntong ito. Naglalaan ang ISO 639-3 ng mga indibidwal na language code para sa mga wikang pasenyas; ikinakatalogo sila ng Glottolog katabi ng mga pamilyang pasalita. Kabilang sa aming catalog ang mahigit 160 sa mga ito, na naka-tag bilang `modality: signed`.

Ang ilan ay mga endangered Indigenous languages: ang Plains Indian Sign Language (`psd`), na sa kasaysayan ay isang mahalagang intertribal lingua franca sa buong North America, ay critically endangered ngayon (Davis 2010, *Hand Talk*). Ang endangerment ng wikang pasenyas *ay* endangerment ng Indigenous language, at bahagi ito ng misyon ng proyektong ito.

**Isang tapat na tala tungkol sa saklaw.** Kasalukuyang nagbe-benchmark ang Network ng *text-based* machine translation. Ang MT para sa wikang pasenyas — na gumagana sa video, spatial grammar, at mga wikang walang malawakang pinagtibay na nakasulat na anyo — ay ibang teknikal na problema at higit na hindi pa nalulutas (tingnan ang Yin et al. 2021, "Including Signed Languages in Natural Language Processing," ACL). Hindi pa namin ito naseserbisyo. Eksaktong iyon ang sinasabi ng mga entry ng wikang pasenyas sa aming catalog: **hindi pa naseserbisyo — hindi kailanman "hindi isang wika."**

## May dalawang modality. Hindi isa sa mga ito ang pagsulat.

May dalawang pangunahing modality ang mga wika: **pasalita** at **pasenyas**. Hindi ikatlong modality ang pagsulat — isa itong teknolohiyang nakapatong sa ibabaw ng isang wika, at karamihan sa mga wika sa mundo ay umiiral nang walang standardized na sistema nito. Iyan ang dahilan kung bakit hiwalay na sinusubaybayan ng aming mga language card ang pagsulat (kung aling mga script ang ginagamit ng isang wika, o kung wala man itong standardized orthography) at tapat itong sinusubaybayan: para sa isang text-based na MT platform, mahalagang impormasyon kung nakasulat ba ang isang wika, hindi isang footnote — at ang wikang hindi nakasulat ay hindi mas mababang uri ng wika.

## Constructed languages: kasama. Programming languages: hindi kasama.

Sinusunod namin ang sariling linya ng ISO 639-3. Tinatanggap ng standard ang isang constructed language lamang kung ito ay isang kumpletong wika, dinisenyo para sa komunikasyon ng tao, may panitikan at komunidad na nakapagpasa nito sa ikalawang henerasyon ng mga user — at malinaw nitong hindi isinasama ang mga computer programming language. Ang Esperanto, kasama ang mga native speaker nito, ay kuwalipikado; ang Python ay hindi, dahil walang sinumang natututo ng Python bilang unang wika mula sa kanilang mga magulang. Kabilang sa aming catalog ang dalawang dosenang constructed language na kinikilala ng ISO, na naka-type bilang ganoon, at walang programming languages.

## Nagbe-benchmark kami ng mga indibidwal na wika, hindi ng mga payong

Pinag-iiba ng ISO 639-3 ang *mga indibidwal na wika* mula sa *macrolanguages* — mga umbrella code tulad ng `cre` (Cree), `ara` (Arabic), o `zho` (Chinese) na sumasaklaw sa ilang magkakaugnay na indibidwal na wika. Ang benchmark unit ng Network ay ang **indibidwal na wika**, para sa isang operasyonal na dahilan: variety-specific ang mga translation resource. Ang morphological analyzer na ginawa para sa Plains Cree (`crk`) ay hindi bumubuo ng Moose Cree (`crm`); kakaunti ang masasabi ng corpus ng Egyptian Arabic tungkol sa kalidad ng isang method sa Moroccan Arabic. Ang score na ikakabit sa isang umbrella code ay magiging pag-aangkin tungkol sa mga variety na hindi naman talaga nasuri — kaya hindi namin iyon ginagawa.

Lumalabas pa rin ang mga macrolanguage sa catalog bilang **mga hub page**: navigation na nag-uugnay ng isang umbrella identity sa mga indibidwal nitong miyembro, na sumasalamin sa sariling obserbasyon ng ISO na parehong tunay ang dalawang antas ng identity. Sa ibaba ng indibidwal na wika, ipinapakita namin ang impormasyon tungkol sa dialect at lineage mula sa languoid tree ng Glottolog (Hammarström & Forkel 2022), na nagmomodelo sa mga pamilya, wika, at dialect bilang isang hierarchy na maaaring i-navigate.

**Paano po ang mga corpora na dumarating na may label na umbrella code?** Marami po sa mga totoong data ang ganito — mga dataset na inilathala bilang "Quechua," "Persian," o "Chinese (Simplified)." Itinuturing po namin ang upstream label bilang *metadata na kailangang i-resolve*, hindi isang katotohanan na dapat sundin o balewalain. Ang mga mekanikal na kaso ay awtomatikong nare-resolve mula sa mga opisyal na ISO table: inaalis ang isang script tag (ang `cmn-Hans` ay Mandarin Chinese, na nakasulat sa Simplified Han — ang script ay itinatala, ang pagkakakilanlan ng wika ay `cmn`), at ang isang retiradong code ay sumusunod sa opisyal na kahalili nito. Kapag idinokumento ng publisher kung anong variety talaga ang kanilang data — nilalagyan ng code ng FLORES+ ang kanilang Quechua record na `quy`, Ayacucho Quechua — itinatala po namin ang resolution na iyon *kasama ang citation* sa registry entry ng corpus, at ang corpus ay bina-benchmark sa ilalim ng totoong indibidwal na wika. At kapag walang makapagsabi kung anong variety ang nilalaman ng isang koleksyon (ang ilang community sentence collection ay sadyang nagpapanatili ng pangkalahatang "Arabic" na kategorya), hindi po kami nanghuhula: ang corpus ay nananatiling naka-catalogue sa ilalim ng sarili nitong label, hindi ito isinasama sa work queue nang may machine-readable na dahilan na maaari ninyong makita sa metadata ng queue, at ang anumang mga historical score nito ay nananatiling nakakabit sa isang tapat na naka-label na umbrella node — hindi kailanman tahimik na inilalagay sa isang variety na hindi naman na-evaluate. Ang bawat resolution ay maaari pong muling makuha (re-derivable): ang mga naka-pin na ISO table, ang mga per-corpus resolution stamp, at ang mga citation ay lahat kasama sa pampublikong registry.

## Kapag hindi nagkakasundo ang mga awtoridad, ipinapakita namin ang pareho

Paminsan-minsan, magkaiba ang paghahati o pagsasama ng ISO 639-3 at Glottolog, at minsan ay hindi rin sumasang-ayon ang mga komunidad sa alinman sa dalawa. Hindi kami humahatol. May affordance na *taxonomy notes* ang mga language card na nagpapakita ng hindi pagkakasundo kasama ang mga sanggunian, at sumusunod ang pagpapangalan sa komunidad saanman nagpahayag ang komunidad ng kagustuhan. Kung ang isang variety ay "isang wika" ba ay, sa huli, bahagyang tanong ng identity — at ang mga tanong ng identity ay nararapat sa mga komunidad mismo, isang prinsipyong hinango namin mula sa mga Indigenous data-governance framework.

## Isang direksiyon ng pananaliksik: mga benchmark bilang instrumentong panukat

Isang bagay na nalilikha ng isang arena na tulad nito, halos bilang by-product, ay isang bagong uri ng ebidensiya tungkol sa kung gaano talaga kalapit ang mga language variety sa *operasyonal* na antas. Kung ang isang translation method, na pinananatiling pareho, ay nagseserbisyo sa ilang magkakaugnay na variety sa deployable quality, magkakakluster ang mga variety na iyon sa praktika; kung nangangailangan sila ng magkakahiwalay na corpus at magkakahiwalay na method, operasyonal silang magkakaiba — anuman ang sinasabi ng naming politics. Kahawig ito ng mas matatandang empirikal na tradisyon, mula sa recorded-text intelligibility testing hanggang sa automated lexical-distance measures, na may twist na nakabatay sa deployment.

Iniaalok namin ito nang maingat, bilang direksiyon ng pananaliksik sa halip na pag-aangkin. Ang method-transfer results ay naaapektuhan ng corpus size, domain, orthography, at training-data contamination, at ang isang clustering ay palaging relatibo sa isang method at quality threshold. Higit sa lahat: maaaring *magbigay-impormasyon* ang signal na ito sa mga usapan tungkol sa wika at dialect, ngunit hindi nito kailanman pinapawalang-bisa kung paano kinikilala ng isang komunidad ang sarili nitong wika.

---

## References

- Davis, Jeffrey E. (2010). *Hand Talk: Sign Language among American Indian Nations.* Cambridge University Press.
- Dryer, Matthew S. & Martin Haspelmath, eds. (2013). *The World Atlas of Language Structures Online.* https://wals.info
- Hammarström, Harald & Robert Forkel (2022). "Glottocodes: Identifiers Linking Families, Languages and Dialects to Comprehensive Reference Information." *Semantic Web* 13(6).
- Haugen, Einar (1966). "Dialect, Language, Nation." *American Anthropologist* 68(4).
- ISO 639-3 Registration Authority. "Scope of denotation" at "Types of individual languages." https://iso639-3.sil.org/about/scope · https://iso639-3.sil.org/about/types
- Klima, Edward S. & Ursula Bellugi (1979). *The Signs of Language.* Harvard University Press.
- Sandler, Wendy & Diane Lillo-Martin (2006). *Sign Language and Linguistic Universals.* Cambridge University Press.
- Stokoe, William C. (1960). *Sign Language Structure.* Studies in Linguistics, Occasional Papers 8.
- Weinreich, Max (1945). "Der YIVO un di problemen fun undzer tsayt." *YIVO Bleter* 25(1).
- Yin, Kayo, Amit Moryossef, Julie Hochgesang, Yoav Goldberg & Malihe Alikhani (2021). "Including Signed Languages in Natural Language Processing." *Proc. ACL-IJCNLP 2021.* https://aclanthology.org/2021.acl-long.570/


## Saan ito patungo sa site na ito

Ang mga panuntunan sa pagbibilang dito po ang sumasaklaw sa bawat numero sa site na ito: inilalapat ng
[metodolohiya ng coverage](/docs/network/context/coverage-counting) ang mga ito sa mga MT service, at itinatala ng mga
[language card](/docs/reference/language-card-spec), bawat wika,
kung ano talaga ang sinasabi ng bawat source.
