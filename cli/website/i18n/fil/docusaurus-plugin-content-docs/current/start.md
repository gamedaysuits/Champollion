---
title: "Magsimula ng proyekto"
slug: /start
description: "Simulan ang pagbuo ng tagasalin para sa inyong wika — kasama ang isang AI assistant sa inyong computer, o sa pamamagitan ng pag-type mismo ng apat na command."
---

# Magsimula ng proyekto

May dalawang paraan upang magsimula. Sa alinmang paraan, tatakbo ang mga kagamitan sa sarili ninyong computer, at gagabayan kayo ng mga ito nang paisa-isang hakbang.

## Gamit ang isang AI assistant

Ito ang pinakamadaling paraan. Ang inyong assistant ang magta-type; sasagutin po ninyo ang mga tanong na para sa inyo.

**Ang kailangan ninyo:** isang AI assistant na tumatakbo bilang app sa inyong computer — hindi lamang app sa telepono — at may kakayahang gumamit ng mga kagamitan doon.

### 1. Idagdag ang mga rail sa inyong assistant

Kopyahin ang maikling setting sa ibaba, i-paste ito sa inyong assistant, at sabihing:
*"Pakiayos po ito para sa akin."* Maraming assistant ang may kakayahang gawin ito. Kung hindi kaya ng sa inyo, humingi ng tulong sa isang maalam sa computer upang gawin ito nang minsan — nasa ibaba lamang ang mga hakbang.

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

<details>
<summary>Manu-manong pag-set up</summary>

Kumokonekta ang mga assistant sa mga kagamitan sa pamamagitan ng isang karaniwang pamantayan na tinatawag na MCP; sinasabi ng setting sa itaas sa inyong assistant kung paano sisimulan ang mga rail. Kailangan din ng inyong computer ang Node.js 20.11 o mas bago, isang libreng programa.

- **Desktop app ng Claude:** Settings → Developer → Edit Config. Idagdag ang
  setting sa file na iyon, i-save ito, at i-restart ang app.
- **Claude Code:** patakbuhin ito nang minsan sa isang terminal:
  `claude mcp add champollion -- npx -y champollion-mcp-server`
- **Cursor:** idagdag ang setting sa `mcp.json` file sa `.cursor`
  folder ng inyong proyekto, o sa `.cursor` folder sa inyong home folder.

</details>

### 2. Sabihin dito, gamit ang sarili ninyong mga salita

Tulad ng:

> *Nais naming bumuo ng tagasalin mula Ingles patungo sa aming wika — gamitin ang
> champollion.*

### 3. Sagutin ang mga itatanong nito

Una, uulitin nito ang direksiyon sa inyo — *"Ingles ang ipapasok ninyo, at ang
inyong wika ang lalabas. Ganoon po ba ang nais ninyong ayos?"* — dahil madaling
magkamali at mabaligtad ito. Pagkatapos, gagawa ito ng folder ng proyekto at
hihingin ang inyong mga file.

Mula noon, magtatanong ito tuwing may desisyong kayo ang dapat gumawa: kung kanino
pagmamay-ari ang inyong mga salita, kung maaaring matuto ang isang tagasalin mula
sa mga ito, kung may dapat i-install. Kayo po ang magpasya para sa inyong sarili.
Kung hindi pa ninyo alam, sabihin lamang ito — makapaghihintay ang mga rail. At ang
*hindi muna ngayon* ay palaging katanggap-tanggap na sagot: hindi na muling magtatanong
ang mga rail sa sesyong iyon.

**Isang bagay na dapat malaman muna.** Karamihan sa mga assistant ay ipinapadala
ang kanilang nababasa sa kumpanyang nagpapatakbo sa kanila. Para sa mga file na
nakatago sa computer na ito, ipinapaalam lamang ng mga tool sa inyong assistant
kung *ilang* pangungusap ang mayroon kayo, kailanman ay hindi ang mismong mga
pangungusap — ngunit ang isang assistant na may access sa inyong computer ay
maaaring magbukas ng anumang file na kaya ninyong buksan. Para sa mga salitang nais
ninyong panatilihing pribado, hilingin dito na huwag itong gawin, o gumamit ng
assistant na tumatakbo sa sarili ninyong computer. Ipinapaliwanag ito sa [Inyong mga salita, inyong mga panuntunan](/docs/your-words-your-rules).

## Sa sarili ninyo

Kung komportable kayong mag-type ng mga command, apat na linya lamang ito. I-install
ang tool ng proyekto (kailangan nito ng Node.js 20.11 o mas bago), simulan ang isang
proyekto, at magtanong kung ano ang susunod:

```bash
npm install -g champollion
champollion new family --from English --to qaa --target-name "Our language"
cd family
champollion next
```

Ang `qaa` ay nangangahulugang "isang wikang wala pang code" — maayos itong
gumagana; hindi lamang pupunan ng mga kagamitan ang mga impormasyon tulad ng
inyong alpabeto para sa inyo. Ang pangalang nasa loob ng panipi ang itatawag ninyo
rito. Kung may code ang inyong wika, o may pangalang alam na ng mga kagamitan,
gamitin iyon sa halip. Kung ang isang pangalan ay maaaring tumukoy sa higit sa isang
wika, tanungin ang inyong mga tagapagsalita kung alin ang kanilang sinasalita bago
pumili ng code; hanggang sa magsabi sila, gagana ang `qaa`, ngunit wala itong
language card, kaya walang panuntunan sa maramihan o script na magmumula roon.

Mula noon, palaging tinutukoy ng `champollion next` ang susunod na hakbang at ang
eksaktong command para rito. Kapag oras na para turuan ang isang tagasalin,
magtatanong muna ang mga rail bago i-install ang mga kagamitan sa pagsasanay.

## Paggawa nang walang internet

Manatiling online habang nag-i-install at sa inyong unang pagsasanay: mada-download
sa panahong iyon ang mga kagamitan sa pagsasanay, at ang mas malakas na tagasalin
(humigit-kumulang 1.2 GB). Pagkatapos niyon, sa inyong computer na magaganap ang gawain.
Upang pigilan ang sariling paghahanap ng mga kagamitan — maaari silang kumuha ng
pampublikong information card ng wika, na nagpapadala lamang ng code ng wika —
itakda ito sa inyong terminal at sa mga setting ng inyong assistant:

```bash
export CHAMPOLLION_OFFLINE=1
```

Ang isang AI assistant na tumatakbo sa mga computer ng isang kumpanya ay
nangangailangan pa rin ng internet. Para sa gawaing ganap na offline, gumamit ng
isa na tumatakbo sa sarili ninyong computer.

## Ang dapat asahan

Ang inyong unang tagasalin ay malamang na magiging isang phrasebook: mahusay sa
mga pangungusap na katulad ng mga natutuhan nito, at wala pa gaanong iba. Doon
nagsisimula ang bawat proyekto. Malinaw na sinasabi ng [Kung ano ang hindi pa nito kayang gawin](/docs/what-it-cant-do-yet)
ang dapat asahan, at ipinapakita ng [Gawing mas mahusay](/docs/make-it-better)
kung paano ito umuunlad.

**Susunod:** [Dalhin ang mayroon kayo →](/docs/bring-your-data)

## Magbasa pa

- [Pagpapatakbo sa mga rail sa pamamagitan ng MCP](/docs/agents/mcp) — ang anim na
  tool, ang loop, at ang detalyadong pag-set up para sa bawat assistant.
- [Pagpapatakbo sa mga rail mula sa shell](/docs/agents/shell) — bawat command
  na pinapatakbo ng mga rail.
- [Ang kasunduan sa pagpapatakbo](/docs/agents/contract) — ang mga panuntunang
  sinusunod ng inyong assistant.
- [Kung sino ang maaaring gumamit nito](/docs/getting-started/who-may-use-this) —
  ang lisensya.
