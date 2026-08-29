---
sidebar_position: 4
title: "Seguridad"
---

# Seguridad at Kaligtasan

Idinisenyo ang Champollion upang maging ligtas sa mga adversarial environment — kung saan maaaring magmula ang locale data sa mga hindi pinagkakatiwalaang source, kung saan maaaring makalabas sa directory boundaries ang mga sinadyang file name, at kung saan maaaring maglaman ng kahit ano ang LLM output.

## Threat Model

| Banta | Attack Vector | Mitigation |
|--------|--------------|-----------|
| **Prototype pollution** | Mga sinadyang JSON key (`__proto__`, `constructor`) | Tinatanggihan sa parse time |
| **Path traversal** | Mga locale code tulad ng `../../etc/passwd` | Bine-validate ang file writes sa mga naka-configure na directory |
| **Code block corruption** | Nagsasalin ang LLM sa loob ng code fences | Unicode sentinel shielding |
| **Hallucinated keys** | Nagbabalik ang LLM ng mga key na hindi ipinadala | Response validation — tanging mga tinanggap na key ang isinusulat |
| **Runaway token spend** | Walang-hanggang retry loops | Nililimitahan ng budget sa pamamagitan ng `maxRetries` |

## Prototype Pollution Guard

Lahat ng locale key ay bine-validate laban sa isang blocklist bago iproseso:

- `__proto__`
- `constructor`
- `prototype`

Anumang key na tumutugma sa mga pattern na ito ay tinatanggihan nang may error. Pinipigilan nito ang mga attacker na gumamit ng sinadyang locale files upang baguhin ang JavaScript object prototypes.

## Path Containment

Kapag nagsusulat ng locale files, vine-validate ng champollion na nananatili ang output path sa loob ng mga naka-configure na directory (`localesDir`, `contentDir`). Sini-sanitize ang mga locale code — ang code na tulad ng `../../secrets` ay hindi makapagsusulat sa labas ng inaasahang directory.

## Block Protection

Sa panahon ng Markdown content translation, pinapalitan ang mga structured element ng Unicode sentinel placeholders bago ipadala ang text sa LLM:

1. **Code blocks** (fenced at inline) → sentinel
2. **Hugo shortcodes** (`{{< >}}`, `{{% %}}`) → sentinel  
3. **Raw HTML** → sentinel
4. **Interpolation variables** (`{{ .Count }}`) → sentinel

Pagkatapos ng translation, pinapalitan ang mga sentinel ng orihinal na content. Hindi kailanman nakikita ng LLM ang code blocks, shortcodes, o HTML — kaya hindi nito maaaring masira ang mga ito.

## Response Validation

Kapag nagbalik ang LLM ng JSON response, vine-validate ng champollion na:
- Tanging mga key na ipinadala sa batch ang lumilitaw sa response
- Walang karagdagang key na ini-inject
- Napi-parse ang response bilang valid JSON

Tahimik na inaalis ang mga hallucinated key. Pinipigilan nito ang LLM output na mag-inject ng hindi inaasahang translations sa inyong locale files.

## Quality Gate

Bawat translation ay vine-validate sa pamamagitan ng limang deterministic checks bago ito isulat sa disk. Tingnan po ang [Quality Gate](/docs/concepts/quality-gate) para sa mga detalye.

## Exponential Backoff

Gumagamit ang mga API call ng exponential backoff na may jitter sa 429 (rate limit) at 5xx (server error) responses. Tatlong retry na may papataas na delay ang pumipigil sa paulit-ulit na paghampas sa API habang may outage.

## Request Timeout

Bawat API request ay may 30-second timeout sa pamamagitan ng `AbortController`. Pinipigilan nito ang sync process na mabitin nang walang hanggan sa isang patay na connection.

## Fail-Loud Translation Failures

Kapag hindi available ang API o nabigo ang isang translation, naghahagis ang champollion ng malinaw na error na may actionable guidance sa halip na tahimik na magsulat ng basura. Walang `[EN]`-prefixed placeholders ang kailanman isinusulat habang nagsi-sync.

```
[ERR] Content sync for fr: no API key available.
  Set OPENROUTER_API_KEY in .env.local to translate content.
```

Ang pagkabigo ng isang file ay hindi nagpapahinto sa buong sync — nilo-log ang error at nagpapatuloy ang pipeline sa susunod na file, kaya nakakakuha po kayo ng pinakamataas na progress sa bawat run.

## Post-Sync Verification

Pagkatapos makumpleto ang lahat ng translation, muling binabasa ng champollion ang naisulat na locale files mula sa disk at nagpapatakbo ng verification pass. Nahuhuli nito ang puwang sa pagitan ng sync na nag-uulat ng success at ng translations na mali sa aktwal:

- **Key parity** — lahat ng source key ay naroroon sa bawat target
- **`[EN]` markers** — legacy fallback markers mula sa mga naunang run
- **Empty translations** — mga blank value na nakalusot
- **Script compliance** — non-Latin locales na may ASCII-only translations
- **Placeholder preservation** — tumutugma ang ICU placeholders sa source

I-skip gamit ang `--no-verify` o patakbuhin nang standalone gamit ang `npx champollion verify`.

## Testing

Vine-verify ang mga security property ng adversarial test suite:

```bash
npm run test:redteam    # prototype pollution, path traversal, encoding attacks
```

---

## Tingnan Din

- [Architecture](/docs/concepts/architecture) — kung paano nag-uugnay ang three-piece ecosystem
- [CLI Reference — integrity](/docs/reference/cli#integrity) — command para sa integrity checking
- [CLI Reference — provenance](/docs/reference/cli#provenance) — command para sa provenance auditing
- [Plugin Specification](/docs/reference/plugin-spec) — mga provenance field sa plugin manifests
- [Quality Gate](/docs/concepts/quality-gate) — translation-level safety checks
