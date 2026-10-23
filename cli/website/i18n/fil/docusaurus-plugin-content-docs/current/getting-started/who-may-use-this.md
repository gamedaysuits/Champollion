---
title: "Sino ang maaaring gumamit nito, at kung magkano ito"
description: "Libre para sa mga pamilya, paaralan, kawanggawa, at pampublikong serbisyo; libre ang mga komersiyal na lisensya para sa mga komunidad ng tagapagsalita kapag hiniling. Ang lisensya ng bawat package sa payak na pananalita — isang buod, hindi legal na payo; ang teksto ng lisensya ang mangingibabaw."
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# Sino ang maaaring gumamit nito, at magkano ito

**Sa madaling salita:**

- **Libre** para sa mga pamilya, paaralan, kawanggawa, pampublikong serbisyo tulad ng mga ospital,
  mismong mga tanggapan ng pamahalaan, at mga personal o pampananaliksik na proyekto.
- **Komersyal na paggamit** — isang app ng wika, isang bayad na serbisyo — ay hindi sakop ng
  libreng lisensya. **Kung nais ng inyong komunidad ng mga tagapagsalita na gamitin ang mga kagamitan
  para sa komersyo, magtanong lamang, at libre ang lisensya.**
  [Humiling ng lisensya](mailto:info@champollion.dev?subject=Commercial%20licence%20request).
- **Walang bahagi.** Ang Champollion ay hindi kumukuha ng anumang bahagi sa anumang kikitain ng isang komunidad mula
  sa sarili nitong wika. Kung pinopondohan ng isang sponsor ang gawain, ang pera ay direktang napupunta sa komunidad.
- **Opsyonal ang tulong.** Kung nais ninyo ng mga taong tutulong sa inyong proyekto, [mag-usap tayo](/docs/getting-help) — pinagkakasunduan ang mga tuntunin sa bawat komunidad, at
  walang listahan ng presyo. Hindi ninyo kami kailanman kailangan upang matapos ito.

Ito lamang ang kailangan ng karamihan. Ang natitira sa pahinang ito ay ang mga detalye, para sa mga abogado at developer: ang mga package ng Champollion ay walang iisang lisensya, at ipinapaliwanag ng pahinang ito, sa payak na pananalita, kung sino ang saklaw ng bawat isa.

**Ito ay isang buod lamang, hindi legal na payo. Ang opisyal na teksto ng lisensya ang mangingibabaw.** Naka-link ang bawat lisensya sa talahanayan sa ibaba at kasama sa package nito.

## Ang mga package at ang kanilang mga lisensya

| Package | Ano ito | Lisensya |
|---|---|---|
| `champollion` (npm) | Ang kagamitan ng proyekto: ang mga riles, at pagsasalin ng mga file ng app at site | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | Ang MCP server na nagbibigay sa mga AI agent ng mga kagamitang ito | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | Ang suite para sa pagsasanay ng modelo | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI; ang utos na `mt-eval`) | Ang evaluation harness | [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE), na may [eksepsyon para sa plugin](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md) |
| `champollion-lyss` (PyPI) | Ang plugin ng pamantayan sa ebalwasyon para sa Plains Cree | Ang sarili nitong pansamantalang lisensya: magagamit lamang nang may pahintulot ([sa PyPI](https://pypi.org/project/champollion-lyss/)) |

Ang mga data registry (`shared/`) at ang mga database migration (`mt-eval-arena/`) sa [repository](https://github.com/gamedaysuits/Champollion) ay Apache-2.0.

## Ang CLI, ang MCP server, at ang nmt-forge

Ang tatlong ito ay nasa ilalim ng PolyForm Noncommercial License 1.0.0. Maaari ninyong gamitin, baguhin, at ibahagi ang mga ito para sa **layuning hindi pangkomersiyo**. Mismong ang lisensya ang tumutukoy sa mga layuning iyon. Dalawa sa mga sugnay nito ang nagpapasya sa karamihan ng mga sitwasyon:

> **Mga Personal na Paggamit.** Ang personal na paggamit para sa pananaliksik, eksperimento, at pagsubok para sa kapakanan ng kaalamang pampubliko, personal na pag-aaral, pribadong libangan, mga proyektong hobby, mga gawaing amateur, o gawaing panrelihiyon, nang walang anumang inaasahang komersyal na aplikasyon, ay itinuturing na paggamit para sa isang pinahihintulutang layunin.

> **Mga Hindi Pangkomersyong Organisasyon.** Ang paggamit ng anumang organisasyong pangkawanggawa, institusyong pang-edukasyon, pampublikong organisasyon sa pananaliksik, organisasyong pangkaligtasan o pangkalusugan ng publiko, organisasyong nagpoprotekta sa kapaligiran, o institusyon ng pamahalaan ay itinuturing na paggamit para sa isang pinahihintulutang layunin anuman ang pinagmulan ng pagpopondo o mga obligasyong dulot ng nasabing pagpopondo.

Para sa isang organisasyon na kabilang sa mga uring iyon, kung paano ito pinopondohan ay hindi magbabago sa sagot: sinasabi ng sugnay na "anuman ang pinagmulan ng pondo" ("regardless of the source of funding").

| Sino | Saklaw ba? | Bakit |
|---|---|---|
| Isang paaralang nagsasalin ng app o newsletter nito | ✓ Oo | Isang institusyong pang-edukasyon |
| Isang pampublikong ospital o pampublikong klinika sa kalusugan na nagsasalin ng mga tagubilin para sa pasyente | ✓ Oo | Isang organisasyon para sa pampublikong kaligtasan o kalusugan |
| Isang kawanggawa na nagsasalin ng website nito | ✓ Oo | Isang kawanggawang organisasyon |
| Isang tanggapan ng pamahalaan, o isang pampublikong surian sa pananaliksik | ✓ Oo | Isang institusyon ng pamahalaan, o isang pampublikong organisasyon sa pananaliksik |
| Kayo, sa isang personal o pampananaliksik na proyekto na walang inaasahang komersiyal na aplikasyon | ✓ Oo | Personal na paggamit para sa pananaliksik, eksperimento, pagsubok, pribadong pag-aaral, o libangan |
| Isang tindahang nagsasalin ng storefront nito | ✗ Hindi | Ang produkto ng isang negosyong kumikita (for-profit) ay komersiyal na paggamit |
| Isang pribadong klinikang kumikita (for-profit) na nagsasalin ng portal ng pasyente nito | ✗ Hindi | Ang produkto ng isang negosyong kumikita ay komersiyal na paggamit. Hindi ito isang pampublikong organisasyon sa kalusugan |

Hindi sakop ang layuning komersyal: hindi ito nagbibigay ng pahintulot para doon.
Kung nais ng isang komunidad ng mga tagapagsalita na gamitin ang mga kagamitang ito sa paraang komersyal, maaari itong humiling ng
komersyal na lisensya, at para sa isang komunidad ng mga tagapagsalita ay libre ang lisensyang iyon:
[humiling ng isa](mailto:info@champollion.dev?subject=Commercial%20licence%20request).

## Ang evaluation harness (`mt-eval-harness`)

Ang harness ay open source sa ilalim ng GNU Affero General Public License, bersyon 3 o mas bago (AGPL-3.0-or-later). Pinahihintulutan ng AGPL ang komersiyal na paggamit, ayon sa sarili nitong mga tuntunin. Kabilang sa mga pangunahin dito ang:

- Kung ipapamahagi ninyo ang harness, binago man o hindi, dapat ninyo itong gawin sa ilalim ng parehong lisensya, kasama ang source code nito.
- Kung babaguhin ninyo ang harness at pahihintulutan ang ibang taong gamitin ito sa isang network, dapat ninyong ialok sa mga taong iyon ang source code ng inyong binagong bersyon (seksyon 13, "Remote Network Interaction").

Ang isang hiwalay na pahintulot ([LICENSE-EXCEPTION.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md), sa ilalim ng AGPL seksyon 7) ay nagpapahintulot sa mga evaluation-standard plugin na nasa ilalim ng ibang mga lisensya na gumana kasama ang harness sa pamamagitan ng public plugin interface nito. Hindi nito binabago ang mismong lisensya ng harness.

## Ang Plains Cree plugin (`champollion-lyss`)

Ang `champollion-lyss` ay may sariling pansamantalang lisensya: magagamit lamang ito nang may nakasulat na pahintulot. Karaniwang ipinagkakaloob ang pahintulot nang walang bayad para sa di-pangkomersiyong pananaliksik, edukasyon, at paggamit para sa kapakinabangan ng komunidad. Walang komersiyal na paggamit ang pinahihintulutan. Isa itong pansamantalang lisensya, na nilalayong palitan ng mga tuntuning itatakda sa pamamagitan ng pamamahala ng komunidad (community governance). Kasama sa package ang teksto ng lisensya at ang NOTICE nito.

## Ang hindi saklaw ng mga lisensyang ito

Ang mga serbisyo sa pagsasalin, modelo, at corpora na ginagamit ninyo sa pamamagitan ng mga tool na ito ay nagpapanatili ng sarili nilang mga tuntunin: mga tuntunin sa API ng provider, lisensya ng modelo, at lisensya ng corpus. Itinatala ng harness ang lisensya ng bawat corpus at ipinapatupad ang mga panuntunan nito kung aling mga serbisyo ng modelo ang maaaring makakita rito, ngunit ang mga tuntuning iyon ay itinakda ng kani-kanilang mga may-ari, hindi ng mga lisensya sa pahinang ito.

## Ang mga teksto ng lisensya

- [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) (nasa [polyformproject.org](https://polyformproject.org/licenses/noncommercial/1.0.0) din): ang CLI, at ang parehong teksto para sa [MCP server](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) at [nmt-forge](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE)
- [GNU AGPL-3.0](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) at ang [eksepsiyon nito para sa plugin](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md): ang harness
- [champollion-lyss](https://pypi.org/project/champollion-lyss/): kasama sa package ang pansamantalang lisensya at NOTICE nito

Ang pahinang ito ay isang buod lamang, hindi legal na payo. Kung may pagkakaiba sa pagitan nito at ng teksto ng lisensya, ang teksto ng lisensya ang mangingibabaw.
