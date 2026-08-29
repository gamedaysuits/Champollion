---
sidebar_position: 1
title: "Sanggunian ng CLI"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Sanggunian ng CLI

## Mga Command

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List all untranslated [EN] fallback values
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and quality tiers
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion leaderboard       Browse and install methods from the Network leaderboard
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion card <code>       Pretty-print a language card (--json for raw output)
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
champollion recommend         Method guidance for a pair — availability + cited evidence
champollion register-corpus   Register a corpus: pick a license + exposure tier (local-only/private/public/sealed)
champollion submit            Propose an index entry (review-gated): prints a pre-filled GitHub issue
champollion seal-corpus <sub> Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
```

Patakbuhin ang `champollion <command> --help` para sa detalyadong tulong sa anumang command.

## Mga Global Option

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Hugo/Docusaurus content directory for Markdown translation
--source <code>         Override source locale (default: en)
--model <model>         Override translation model (full slug or alias from shared/model-aliases.json)
--method <method>       Translation method: llm, google-translate (default: from config)
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--force                 Re-queue every source key (whole-locale rebuild; scope with --pair)
--force-content         Re-translate all content files (clears content lock)
--force-keys <keys>     Comma-separated dot-notation keys to force re-translate
--no-tm                 Skip Translation Memory cache for this sync run
--no-verify             Skip post-sync verification pass
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

---

## init

Interactive na setup wizard na lumilikha ng `champollion.config.json`. Ginagabayan kayo sa source locale, mga target na wika, file format, at translation model.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
```

**`--langs` option**: Listahan ng mga target na language code na pinaghihiwalay ng kuwit. Nilalaktawan nito ang prompt para sa wika at inilalapat ang default na mga register preset para sa bawat wika. Isama sa `--yes` para sa ganap na non-interactive setup.

**Mga language preset**: Kapag na-prompt para sa mga target na wika, maaari ninyong i-type ang mga preset name:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Paghaluin ang mga preset at indibidwal na code: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Isinasalin ang nawawala at luma nang mga key sa lahat ng locale file. Nagpapatakbo ng post-sync verification bilang default.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --force-keys "hero.title"         # force re-translate
champollion sync --force-keys "a.title,a.subtitle" # multiple keys
champollion sync --pair en:tlh --force             # rebuild one whole locale
champollion sync --pair en:tlh --force --no-tm     # ...bypassing a suspect cache
champollion sync --force-content                   # re-translate all Markdown/MDX
champollion sync --content-dir ./content           # include Hugo Markdown
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Translation Memory**: Bilang default, nilo-load ng `sync` ang `.champollion/tm.json` at naghahatid ng mga naka-cache na salin para sa hindi nagbago na source values. Gamitin ang `--no-tm` upang i-bypass ang cache (kapaki-pakinabang kapag nagpapalit ng mga translation provider o nagde-debug ng kalidad). Tingnan ang [Translation Memory](/docs/concepts/translation-memory).

**Change detection**: Iniimbak ng champollion ang mga SHA-256 hash sa `.champollion.lock`. Kapag nagbago ang source values, awtomatikong muling isasalin ng susunod na sync ang mga key na iyon. I-commit ang lock file upang pare-pareho ang baseline na ibinabahagi ng lahat ng developer.

**Parallelism**: Parehong tumatakbo nang parallel ang JSON key translation at content translation. Sabay-sabay na isinasalin ang mga JSON locale (default: 200 concurrent locale), at naka-parallel din ang mga batch sa loob ng bawat locale (4 concurrent batch). Ang content translation (Markdown, MDX, mga blog post) ay tumatakbo sa isang flat work-item pool (default: 48 concurrent API call). I-override gamit ang `--json-concurrency`, `--content-concurrency`, o `--concurrency` (itinatakda ang pareho).

**Output**: Ipinapakita ng Sync ang isang version banner, pagtukoy sa format/framework, pagtataya ng gastos, at mga progress bar kada locale:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Nag-a-update in-place ang mga progress bar pagkatapos ng bawat batch (~80 key). Gamitin ang `--quiet` para sa mga error/babala lamang, o `--json` para sa machine-readable na NDJSON output. Pareho nitong sinusupil ang progress bar at banner.

---

## watch

Awtomatikong nagse-sync kapag nagbago ang source locale file. Tumatakbo hanggang ihinto gamit ang `Ctrl+C`.

```bash
champollion watch
```

---

## audit

Ilista ang lahat ng hindi naisaling `[EN]`-prefixed fallback value mula sa mga naunang run. Lalabas na may code 1 kung may makita — gamitin bilang CI gate upang mabigo ang mga build na may hindi kumpletong salin.

```bash
champollion audit
```

---

## verify

Muling binabasa ang lahat ng locale file mula sa disk at bine-verify na talagang naroon at tama ang mga salin. Ito ang parehong verification na awtomatikong tumatakbo sa dulo ng bawat `sync` (maliban kung ipapasa ang `--no-verify`).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify && echo "All good" # CI gate
```

**Ang sinusuri nito:**
- Key parity — naroroon ang lahat ng source key sa bawat target
- Mga `[EN]` fallback marker mula sa mga naunang run
- Mga walang laman na salin
- Pagsunod sa script — dapat may non-ASCII na salin ang mga non-Latin locale
- Pagpapanatili ng placeholder — tumutugma ang mga ICU placeholder sa source
- Mga isyu sa encoding — BOM markers, invisible characters
- Source echoes — mga value na kapareho ng source (babala)

---

## lint

Ini-scan ang source code para sa hardcoded na mga user-facing string na dapat gumamit ng mga i18n translation call. Awtomatikong dine-detect ang inyong framework (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**Ang nade-detect nito:**
- Hardcoded na mga string sa JSX text, `placeholder`, `alt`, `aria-label`, `title`
- Mga file na may user-facing content ngunit walang import ng i18n framework
- Dead keys — mga locale key na walang nire-reference na source file
- Coverage score — porsiyento ng mga string na dumadaan sa i18n

**Mga exclusion**: Gumawa ng `.champollionignore` sa project root ninyo (mga glob pattern, tulad ng `.gitignore`).

---

## wrap

Awtomatikong bina-wrap ang hardcoded na mga string na na-detect ng `lint` sa mga `t()` call. Gumagawa ng awtomatikong backup bago baguhin ang mga file.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Mga safety gate:**
1. Git-clean check (nilalaktawan sa dry-run)
2. Awtomatikong backup sa `.champollion-backup/`
3. Diff preview bago ang bawat pagsulat sa file
4. Suporta sa `--undo` upang mag-restore mula sa backup

---

## seo

Bumuo ng mga SEO artifact para sa multilingual na mga site.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Subcommand | Output |
|------------|--------|
| `hreflang` | mga `<link rel="alternate" hreflang>` tag |
| `sitemap` | Multilingual na `sitemap.xml` |
| `jsonld` | JSON-LD WebSite language schema |

---

## integrity

Tinutukoy ang corruption at drift sa mga naisaling locale file.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**Ang mga sinusuri po nito:**
- Pagkasira ng placeholder (hal., ang `{name}` ay nasa source ngunit nawawala sa target)
- Mga isyu sa encoding (mojibake, imbalidong Unicode)
- Mga hindi na-translate na kopya (ang target value ay kapareho ng source) — hindi po kasama ang mga [`noTranslate`](/docs/getting-started/configuration#no-translate) na key, pati na rin ang mga echo na kinukumpirma ng Translation Memory bilang pipeline-produced at gate-approved. Ang natitirang naka-flag ay eksakto kung ano ang ire-requeue ng `sync` — hindi po maaaring magkasalungat ang dalawang tool tungkol sa isang maayos na file
- No-translate drift (isang `noTranslate` na key na *hindi* kapareho ng source) — iniuulat po kasama ang mga inaasahan/aktwal na value at naka-escape na mga invisible character; patakbuhin po ang `champollion sync` upang kumpunihin
- Hindi inaasahang PUA (mga Private Use Area codepoint sa isang locale na naka-off ang [script conversion](/docs/getting-started/configuration#script-conversion) — nagiging blangko kapag walang espesyal na font); patakbuhin po ang `champollion repair-script` upang kumpunihin
- Mga hollowed value (isang target na kapareho ng source nito ngunit tinanggal ang mga titik — pinsala mula sa isang pipeline na mas luma kaysa sa content-preservation gate); i-translate po muli gamit ang `sync --force-keys <key>` o `sync --pair <pair> --force`
- Mga naulilang key (mga key sa target na hindi umiiral sa source)
- Pagkakumpleto ng plural category ng ICU MessageFormat (hal., nangangailangan po ang Arabic ng 6 na kategorya)

---

## repair-script

Binabaligtad po ang script conversion na hindi dapat nangyari: ang mga PUA-encoded na value (pIqaD, Tengwar, Kryptonian) sa mga locale na ang configuration ay nagsasabing naka-off ang conversion ay ibinabalik sa romanization sa pamamagitan ng sariling reverse table ng converter.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Opsyon | Epekto |
|--------|--------|
| `--dry` | I-preview po ang mga pagkumpuni nang hindi nagsusulat |
| `--locale <code>` | Kumpunihin po ang isang locale lamang |
| `--json` | Machine-readable na JSON output |
| `--warn-only` | Mag-exit 0 kahit na may matirang hindi mabaligtad na PUA |

Eksakto pong nababaligtad ang pIqaD. Hindi po maibabalik ng mga pagbaligtad sa Tengwar at Kryptonian ang capitalization (naka-flag bilang case-lossy). Hindi po nangangailangan ng pagkumpuni ang Translation Memory — iniimbak nito ang mga pre-conversion na value. Nag-e-exit 1 po kapag may natirang PUA na hindi kayang baligtarin ng anumang nakarehistrong converter.

---

## tm

Pamahalaan ang Translation Memory cache (`.champollion/tm.json`). Iniimbak ng TM ang mga naunang salin at inihahatid ang mga ito sa mga susunod na sync sa halip na tumawag sa API.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Subcommand | Output |
|------------|--------|
| `stats` | Bilang ng entry, laki ng file, breakdown kada locale |
| `clear` | Tanggalin ang cache file (buo o kada locale) |

| Option | Effect |
|--------|--------|
| `--locale <code>` | I-clear lamang ang mga entry para sa isang locale |
| `--yes` | Laktawan ang confirmation prompt |

Tingnan ang [Translation Memory](/docs/concepts/translation-memory) para sa kung paano gumagana ang TM at kung kailan ito dapat i-clear.

---

## xliff

Mag-export at mag-import ng mga XLIFF 1.2 file para sa pagsusuri ng propesyonal na tagasalin. Ang XLIFF ay ang universal exchange format na sinusuportahan ng mga CAT tool tulad ng memoQ, SDL Trados, at Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Subcommand | Output |
|------------|--------|
| `export` | Bumuo ng `.xliff` mula sa source + target locale files |
| `import` | I-merge ang mga nirepasong salin na `.xliff` sa mga locale file |

| Option | Effect |
|--------|--------|
| `--locale <code>` | Target na locale para sa export (kinakailangan) |
| `--out <path>` | Custom na output path o directory |
| `--dry` | I-preview ang import nang hindi nagsusulat |

Tingnan ang [Paggawa kasama ang mga Propesyonal na Tagasalin](/docs/guides/professional-translators) para sa buong workflow.

---

## status

Ipakita ang pair configuration, mga naka-install na plugin, quality tiers, at benchmark scores.

```bash
champollion status
```

---

## provenance

I-audit ang licensing ng translation resource para sa lahat ng naka-install na plugin.

```bash
champollion provenance
```

---

## plugin

Pamahalaan ang mga translation method plugin. Ang mga plugin ay pre-packaged na translation recipe na naka-install sa `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove crk-coached-v1     # remove a plugin
```

Tingnan ang [Plugin Specification](/docs/reference/plugin-spec) para sa format ng plugin manifest.

---

## leaderboard

Mag-browse, maghanap, at mag-install ng mga translation method mula sa Network leaderboard. Ang mga method na naka-install mula sa leaderboard ay may kasamang benchmark scores at buong canonical MethodConfig — ang eksaktong configuration na ginamit sa evaluation.

```bash
champollion leaderboard                          # show leaderboard
champollion leaderboard --pair en:fr             # filter by language pair
champollion leaderboard --install crk-coached-v8 # install a method plugin
champollion leaderboard --install crk-coached-v8 --apply  # install + patch config
```

| Option | Effect |
|--------|--------|
| `--pair <code>` | I-filter ang leaderboard ayon sa language pair (hal., `en:fr`) |
| `--install <name>` | Mag-install ng method plugin mula sa leaderboard |
| `--apply` | Pagkatapos mag-install, awtomatikong idagdag ang `methodPlugin` sa `champollion.config.json` |

**`--apply` workflow:** Kapag nag-install kayo gamit ang `--apply`, isinusulat ng champollion ang method plugin sa `.champollion/methods/` **at** pini-patch ang inyong `champollion.config.json` upang gamitin ito para sa kaugnay na pair. Ito ang pinakamabilis na landas mula sa "ano ang may pinakamataas na score?" patungo sa "ginagamit ko na ito sa production."

---

## fonts

Nagda-download at namamahala ng mga PUA web font para sa mga constructed language script converter. Ang mga wikang gumagamit ng Private Use Area characters (Klingon, Sindarin, Kryptonian) ay nangangailangan ng custom na web fonts upang mai-render ang kanilang mga script. Dina-download ng command na ito ang mga ito mula sa mga verified open-source repository.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Subcommand | Output |
|------------|--------|
| `list` | Ipinapakita kung aling mga PUA font ang kailangan at ang kanilang install status |
| `install` | Nagda-download ng mga font para sa mga naka-configure na wika |

| Option | Effect |
|--------|--------|
| `--dir <path>` | I-override ang font output directory (awtomatikong nade-detect mula sa project type) |
| `--css` | Bumuo ng isang `conlang-fonts.css` snippet kasabay ng mga font |
| `--config <path>` | Path papunta sa config file (ginagamit upang matukoy kung aling mga wika ang nangangailangan ng font) |

**Auto-detection:** Hinuhula ang output directory mula sa structure ng inyong proyekto:
- **Docusaurus** → `static/fonts/` o `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Default** → `public/fonts/`

Ang **Native Unicode converters** (`crk` → Cree Syllabics, `sr` → Serbian Cyrillic) ay HINDI nangangailangan ng font installation.

Tingnan ang [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) para sa kumpletong detalye ng PUA font.

## Three-Layer Pipeline

Gamitin ang `lint`, `sync`, at `audit` nang magkakasama para sa bulletproof na i18n:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Layer | Command | Kailan | Layunin |
|-------|---------|------|---------|
| **Lint** | `lint` | Pre-commit | Harangin ang mga commit na may hardcoded strings |
| **Sync** | `sync` | Post-commit / CI | Isalin ang nawawala at nagbagong mga key |
| **Verify** | `verify` | Post-sync / CI | Kumpirmahing naroroon at tama ang mga salin |
| **Audit** | `audit` | Build step | Pabiguin ang deployment kung may anumang locale na may mga marker na `[EN]` |

---

## Tingnan Din

- [Configuration](/docs/getting-started/configuration) — sanggunian ng config file
- [Translation Methods](/docs/guides/translation-methods) — pagpili ng method kada pair
- [Translation Memory](/docs/concepts/translation-memory) — caching at pagtitipid sa gastos
- [Paggawa kasama ang mga Propesyonal na Tagasalin](/docs/guides/professional-translators) — XLIFF workflow
- [Plugin Specification](/docs/reference/plugin-spec) — format ng plugin manifest
- [Gabay sa CI/CD](/docs/guides/ci-cd) — pag-automate ng mga CLI command sa inyong pipeline
- [Paano Gumagana ang Sync](/docs/concepts/how-sync-works) — pag-unawa sa sync pipeline
- [Quality Gate](/docs/concepts/quality-gate) — kung paano vina-validate ang mga salin
