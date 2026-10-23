---
sidebar_position: 1
slug: /intro
title: "Pagsasalin ng app at site"
description: "Ang sanggunian para sa pagsasalin ng sariling mga file ng isang app o website gamit ang `champollion sync`: kung ano ang ginagawa nito, kailan ito dapat gamitin, at isang gabay sa bawat pahina tungkol dito."
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How Sync Works"
    to: /docs/concepts/how-sync-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, machine-translation APIs, your own model — when to use which"
  - label: "Translate an app or website"
    to: /docs/translate-an-app-or-website
    kind: guide
    note: "The same lane, in plain words"
---

# Pagsasalin ng app at site

Pinapanatili ng `champollion sync` na nakaayon ang mga salin ng isang app o website sa
pinagmulang wika nito. Binabasa nito ang inyong mga locale file (o ang inyong mga pahinang Markdown), hinahanap
ang mga nawawala o luma na, isinasalin lamang ang mga iyon, sinusuri ang bawat resulta, at
isinusulat itong muli sa mismong format ng file.

```bash
npx champollion sync
```

Ang seksiyong ito ang sanggunian para sa linyang iyon. Kung nais ninyo muna ng
mas payak na bersiyon, basahin ang [Magsalin ng app o website](/docs/translate-an-app-or-website).

## Ang ginagawa ng `sync`

1. **Hinahanap ang inyong mga file.** Tinutukoy nito ang folder ng locale at ang format (JSON, TOML,
   YAML, gettext PO, Flutter ARB), o isang folder ng mga pahinang Markdown/MDX (Hugo,
   Docusaurus, o anumang folder na papangalanan ninyo gamit ang `--content-dir`).
2. **Inaalam kung ano ang nagbago.** Ang bawat pinagmulang halaga ay itinatala sa pamamagitan ng SHA-256
   hash nito sa `.champollion.lock`. Ang mga key na nawawala, walang laman, o nagbago ang pinagmulang
   teksto ay inilalagay sa queue; ang iba pa ay hindi ginagalaw.
3. **Nagsasalin gamit ang paraang pinili ninyo para sa bawat pares.** Maaaring magpadala ang isang config file
   ng isang pares sa isang LLM, ng isa pa sa isang machine-translation API, at ng ikatlo
   sa isang model na inyong sinanay at kayo mismo ang nagho-host. Nagsasalin ang mga paraang LLM sa
   temperature na 0 bilang default (ang kaisa-isang default sa `shared/model-defaults.json`);
   maaari pa ring magbago nang kaunti ang isang naka-host na model sa pagitan ng mga pagpapatakbo, na isa sa mga dahilan
   kung bakit itinatago ng Translation Memory ang nakuha na nito.
4. **Muling ginagamit ang binayaran na.** Bina-cache ng Translation Memory ang bawat
   salin ayon sa pinagmulang teksto, locale, at paraan: ang tekstong babalik (isang
   string na ibinalik sa dati, ang parehong pangungusap sa ibang file, isang pag-ulit) ay libre.
5. **Sinusuri ang bawat resulta bago ito isulat.** Tinatanggihan ng quality gate ang walang lamang
   output, kopya ng pinagmulan, mga repetition loop, maling script na output,
   nasirang mga placeholder at katulad na pagkasira, na may isang feedback retry.
   Nahuhuli nito ang sirang output, hindi ang maling kahulugan.
6. **Nagpapatunay pagkatapos magsulat.** Binabasang muli ng isang post-sync pass ang mga naisulat na file at
   sinusuri ang parity ng key, mga walang lamang halaga, script, at mga placeholder;
   pinapatakbo ng `champollion verify` at `champollion audit` ang parehong uri ng mga pagsusuri bilang
   mga CI gate.

Walang isinusulat nang tahimik. Ang isang key na tinatanggihan pa rin ng gate pagkatapos ng retry nito ay
iniiwanang hindi nakasalin at iniuulat, at ang sync ay lalabas nang may `2`. Naaalala
ang pagtanggi, kaya ang susunod na payak na sync ay hindi magbabayad sa parehong model para sa parehong
sagot: magtatanong kayong muli gamit ang `--redo`, magdagdag ng paraang `fallback` sa pares, o
manu-manong isulat ang halaga.

## Kailan ito dapat gamitin

- Mayroon kayong app o website na ang teksto ay nasa mga locale file o Markdown,
  at nais ninyong panatilihing napapanahon ang iba pang wika nito habang nagbabago ang pinagmulan.
- Nais ninyo ng ibang paraan para sa bawat pares ng wika sa isang proyekto, na may limitadong
  gastos (`--max-cost`) at nakikita bago pa may masingil (`--dry`).
- Bumuo kayo ng translator sa mga rail at nais ninyong gamitin ito ng isang app:
  inilalagay ng `champollion connect` ang isang pinagsisilbihang model sa isang proyekto ng app, at ang `sync`
  ay magsasalin gamit ito. Ang isang model na sinanay sa local-only na data ay ikinokonekta
  lamang kapag pumayag na ang mga may-hawak nito.

Ang `sync` ay hindi paraan upang bumuo ng translator para sa isang wikang hindi kayang hawakan
nang maayos ng anumang serbisyo. Para doon, magsimula sa [Magsimula ng proyekto](/docs/start).

## Ang mga pahina sa seksiyong ito

**Pagsisimula**

- [Mabilis na Pagsisimula](/docs/getting-started/quick-start) — isang unang sync sa loob ng ilang minuto.
- [Pag-install](/docs/getting-started/installation) — mga kinakailangan, mga API key,
  at ang lisensiya.
- [Konpigurasyon](/docs/getting-started/configuration) — bawat field sa
  `champollion.config.json`, mga setting para sa bawat pares, mga layout ng locale, at mga fallback.

**Ang inyong framework at pipeline**

- [Mga integrasyon ng framework](/docs/integrations/frameworks) — Hugo, next-intl,
  react-i18next, Flutter, at Django na may gettext.
- [CI/CD](/docs/guides/ci-cd) — `lint`, `sync`, `verify`, at `audit` bilang mga gate.
- [Pagsasalin ng nilalaman](/docs/guides/content-translation) — mga pahinang Markdown
  at MDX, front matter, at kung ano ang pinapanatili.

**Pagpili kung paano ito magsasalin**

- [Mga paraan ng pagsasalin](/docs/guides/translation-methods) — bawat paraan,
  ang key nito, at kailan ito gagamitin.
- [Coaching data](/docs/concepts/coaching-data) — mga tala sa balarila at mga listahan ng salita
  na ibinibigay sa isang LLM kasama ng bawat kahilingan.
- [Mga converter ng script](/docs/concepts/script-converters) at
  [Mga conlang, script, at ortograpiya](/docs/guides/conlangs-scripts-orthography)
  — mga sistema ng pagsulat, mga font, at mga inimbentong wika.

**Kung paano ito gumagana sa loob**

- [Kung paano gumagana ang sync](/docs/concepts/how-sync-works) — ang pipeline, bawat hakbang.
- [Translation memory](/docs/concepts/translation-memory) — ang cache, at kung ano
  ang batayan ng pag-key nito.
- [Quality gate](/docs/concepts/quality-gate) — bawat pagsusuri, at kung ano ang nangyayari
  sa isang tinanggihang key o block.
- [Seguridad](/docs/concepts/security) — mga sadyang binuong key at path, mga protektadong
  code block, at hayagang pagpalya.

**Mga tao at suliranin**

- [Pakikipagtulungan sa mga propesyonal na tagasalin](/docs/guides/professional-translators)
  — pag-export at pag-import ng XLIFF para sa pagsusuri.
- [Pag-troubleshoot](/docs/guides/troubleshooting) — mga karaniwang error at solusyon.

Nasa [Sanggunian ng CLI](/docs/reference/cli) ang bawat command at flag, at ang
format ng plugin ng paraan ay nasa [Pagtutukoy ng Plugin](/docs/reference/plugin-spec).

## Lisensiya

Ang `champollion` CLI ay source-available sa ilalim ng
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE);
isinasaad sa [kung sino ang maaaring gumamit nito](/docs/getting-started/who-may-use-this) kung sino ang saklaw.
May nararanasang problema, o nais ng tulong sa inyong proyekto? [Mag-usap tayo](/docs/getting-help).
