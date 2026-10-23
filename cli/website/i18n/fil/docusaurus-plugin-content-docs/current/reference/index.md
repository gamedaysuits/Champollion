---
title: "Sanggunian"
slug: /reference
description: "Bawat teknikal na detalye sa iisang mapa: ang mga command, ang mga format ng file, ang mga espesipikasyon, ang mga teknikal na limitasyon, pag-host ng sealed test, ang leaderboard, pagsasalin ng app at site, ang Atlas, at ang imprastraktura ng network."
---

# Sanggunian

Ang kumpletong teknikal na talaan, para sa mga developer, mananaliksik, at mga AI agent.
Ikinukwento ng [mga pahina para sa tao](/docs/) ang parehong salaysay sa mga payak na salita, at
sinasabi ng [manwal para sa mga agent](/docs/agents) kung paano ito pinatatakbo ng isang agent; inilalahad ito
ng bawat pahina sa ibaba nang may ganap na katumpakan.

## Mga Command

- [`champollion`](/docs/reference/cli) — bawat command at flag ng tool ng
  proyekto at ng tagasalin ng app at site.
- [`nmt-forge`](/docs/network/getting-started/forge-command-reference) — bawat
  command ng suite sa pagsasanay ng modelo, na binuo mula sa parser nito.
- [`mt-eval`](/docs/reference/mt-eval) — bawat command ng evaluation
  harness, na binuo mula sa parser nito.
- [Ang MCP server](/docs/network/getting-started/mcp-server) — parehong profile,
  bawat tool at bawat argumento.

## Mga Format

- [Mga format ng framework](/docs/reference/formats) — project/1, set/1, method/1,
  gate-chain/1, deployment/1, at service-api/1, mula sa mga schema ng mga ito.
- [Run card](/docs/network/specifications/run-card) — kung ano ang itinatala at
  inilalathala ng isang may-iskor na run.
- [Data ng coaching](/docs/concepts/coaching-data) — ang mga tala sa balarila at
  mga listahan ng salita na ibinibigay sa isang paraan ng LLM.
- [Espesipikasyon ng Plugin](/docs/reference/plugin-spec) — ang manifest ng plugin
  ng paraan (`method.json`) kung saan ipinapadala ang isang paraan ng pagsasalin.
- [Language card](/docs/reference/language-card-spec) — ang schema ng isang card
  sa Atlas.

## Mga Espesipikasyon

- [Pag-iiskor](/docs/network/specifications/scoring) — pamantayan sa pag-iiskor/1: ang
  pangunahing chrF++ ng corpus kasama ang 95% bootstrap interval nito, ang mga karaniwang sukatan
  sa tabi nito, at ang mga diagnostic na pinanatiling hiwalay.
- [Kabuluhan](/docs/network/specifications/significance) — mga paired test,
  at kung kailan mas mahusay ang isang run kaysa sa isa pa.
- [Interface ng paraan](/docs/network/specifications/methods) — kung ano ang isang paraan,
  ang mga klase at dependency nito.
- [Pagkamaaasahan ng sukatan](/docs/network/specifications/metric-reliability) —
  kung aling sukatan ang dapat pagkatiwalaan para sa aling uri ng wika, batay sa mga paghatol ng tao.
- [Benchmark](/docs/network/specifications/benchmark) — ang protokol na sinusunod ng bawat
  wastong run.
- [Harness](/docs/network/specifications/harness) — kung paano tumatakbo,
  nag-iiskor, at naglalathala ang `mt-eval`.
- [Pagpapatunay ng tagapagsalita](/docs/network/specifications/speaker-validation) — ang
  pagsusuri ng tao kung saan humahalili ang mga awtomatikong iskor.

## Mga teknikal na limitasyon

- [Mga teknikal na limitasyon](/docs/network/honest-limitations) — ang mga hindi inaangkin:
  sariling-ulat na mga antas ng tiwala, wala pang pagsusuri ng tagapagsalita, pangangalaga sa selyadong pagsusuri, at walang
  kumpiyansa bawat pangungusap.

## Pag-host ng isang selyadong pagsubok

- [Magpatakbo ng soberanong paligsahan](/docs/network/sovereignty/run-a-sovereign-contest)
  — ang kumpletong runbook para sa isang test set na hindi kailanman umaalis sa makina ng host.
- [Soberanong eval node](/docs/network/sovereignty/sovereign-eval-node) — ang
  makina sa pag-iiskor: hardware, air gap, at seremonya ng susi.
- [Pagpaparehistro ng mga corpus](/docs/network/sovereignty/registering-corpora) —
  mga antas ng exposure at mga landas ng lisensya para sa isang corpus na hawak ninyo.
- [Pagmamay-ari at mga tuntunin](/docs/network/sovereignty/ownership-transfer) at
  [Mga template ng tuntunin](/docs/network/sovereignty/terms-templates) — kung ano ang
  isinusuko ng isang lahok, na ipinapahayag bago lumahok ang sinuman.
- [Mga premyo](/docs/network/specifications/prizes) — kung ano ang kailangan ng isang premyo, kung may
  sponsor na magbubukas nito.

## Leaderboard at paglalathala

- [Leaderboard at paglalathala](/docs/reference/leaderboard) — kung ano ang board,
  ang dalawang uri ng benchmark, at kung ano ang kalakip ng isang inilathalang run.
- [Mga panuntunan sa pagsusumite](/docs/network/leaderboard/rules) — kung ano ang tinatanggap,
  kung ano ang nadidiskwalipika, at ang mga antas ng pag-verify.
- [Mga dataset ng ebalwasyon](/docs/network/leaderboard/datasets) — ang mga nakarehistrong
  dataset at ang mga landas ng lisensya ng mga ito.
- [Magsumite ng paraan](/docs/network/getting-started/submit-a-method) — patakbuhin ang
  harness at maglathala ng run card.
- [Pag-ambag ng compute](/docs/network/getting-started/contributing-compute) —
  magpatakbo ng mga item mula sa pampublikong queue gamit ang inyong sariling key.
- [FAQ](/docs/network/getting-started/faq) — mga sukatan, modelo, FST, at
  diskwalipikasyon.

## Pagsasalin ng app at site

- [Pagsasalin ng app at site](/docs/intro) — kung ano ang ginagawa ng `champollion sync`, at
  isang gabay sa bawat pahina tungkol dito: mabilis na pagsisimula, pag-install, pagsasaayos,
  mga framework, CI/CD, mga paraan, nilalaman, translation memory, ang quality gate,
  seguridad, mga script, mga tagasalin, at pag-troubleshoot.

## Ang Atlas

- [Ang Atlas](/docs/atlas) — kung ano ang index ng wika at kung saan nagmumula
  ang mga katotohanan nito.
- [Espesipikasyon ng language card](/docs/reference/language-card-spec) at ang
  [pamamaraan ng pagbanggit](/docs/reference/language-card-citation-procedure) —
  bawat field, at kung paano binabanggit ang bawat isa.
- [Kung ano ang itinuturing na wika](/docs/network/context/what-counts-as-a-language)
  — ang mga sagot na ibinibigay ng index, at kung bakit.
- [Magsumite sa index](/docs/network/getting-started/submit-to-the-index) at
  [Pag-uulat ng mga pagkakamali](/docs/network/perspectives/reporting-errors-and-owning-corrections)
  — pagpapanukala ng isang lahok o isang pagwawasto.

## Imprastraktura ng network

- [Pagbuo ng queue](/docs/network/specifications/queue-construction) at
  [kung bakit ganito binuo ang queue](/docs/network/perspectives/why-the-queue)
  — kung paano niraranggo ng pampublikong queue ng gawain kung ano ang susunod na susukatin.
- [Lakas ng koneksyon](/docs/network/specifications/connection-strength) —
  kung ano ang sinasabi ng isang arc sa mapa ng network tungkol sa isang pares, at ang antas ng lakas
  na inalis na.
- [Pag-ambag ng compute](/docs/network/getting-started/contributing-compute) —
  pagpapatakbo ng queue.
