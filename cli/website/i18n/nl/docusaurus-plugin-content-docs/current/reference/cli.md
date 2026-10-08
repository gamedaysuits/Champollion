---
sidebar_position: 1
title: "CLI-referentie"
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

# CLI-referentie

## Opdrachten

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List untranslated and out-of-date translations (CI completeness gate)
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and benchmark scores
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
```

De commando's die werken met de gedeelde index en het leaderboard, in plaats van uw
project, zijn gegroepeerd onder `champollion network`. Elk commando werkt ook zonder het
voorvoegsel:

```
champollion network card <code>        What the index knows about a language (--json for raw output)
champollion network recommend <s> <t>  Methods you can run for a pair, with the evidence for each, and open models that declare the target (or one pair: eng-crk)
champollion network leaderboard        Published results; install a proven method (--install, --apply)
champollion network register-corpus    Register a test set without handing it over (local-only/private/public/sealed)
champollion network seal-corpus <sub>  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
champollion network submit             Propose an index entry (review-gated): prints a pre-filled GitHub issue
```

Voer `champollion <command> --help` uit voor gedetailleerde hulp bij elk commando
(`champollion network` toont de netwerkcommando's).

## Globale opties

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Folder of Markdown/MDX to translate (a Hugo content/ or any folder); each translation is written beside its source as <name>.<locale>.md
--source <code>         Override source locale (default: en)
--model <model>         Translation model for this run only (an exact model slug; aliases and floating "-latest" ids are refused); the config is not changed — to switch for good, edit "model" in champollion.config.json
--method <method>       Translation method for this run only: llm, llm-coached, local, openai, anthropic, gemini, google-translate, deepl, … Overrides the config, including a pair's own method (sync says which); scope with --pair. To switch for good, edit "defaultMethod" (or the pair's "method")
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, po, arb, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--redo <scope>          Translate again: all | keys:<k1,k2> | content | files:<glob> (repeatable). Cached text is still served, so a redo is cheap. gaps: every plural message on disk without a form its language uses for ordinary counts — asked from the model, not the cache
--prune plural-extras   sync: remove i18next plural keys for a form the language does not have (Spanish count_two) — only those, each one listed; never without this flag
--fresh                 Don't use the cache for what is queued — it is billed again
--files <glob>          Only these content files this run (repeatable; e.g. docs/intro.md, "posts/**")
--force                 Same as --redo all (whole-locale rebuild; scope with --pair)
--force-keys <keys>     Same as --redo keys:<keys> (namespace::key for one file of a multi-file language; \, for a comma inside a key; ctx\x04msgid — or ctx␄msgid — for a gettext entry with a context)
--force-content         Same as --redo content
--retranslate <glob>    Same as --redo files:<glob> --fresh (bypasses the lock and the cache — billed — and replaces paragraphs a person edited in the named files)
--no-tm                 Same as --fresh
--fresh-on-model-change Don't reuse the previous model's cached translations for what this run translates; with --redo all, the new model translates what an earlier model wrote
--pair <src:tgt>        Only these pairs this run, comma-separated (e.g. en:fr,en:de; en>fr and en-fr work too); unknown pairs fail loud (sync, verify, serve)
--max-cost <usd>        sync: stop before any API call if the estimated cost is over this USD cap, or unknown (exit 2, nothing spent)
--no-verify             Skip post-sync verification pass
--strict                verify: warnings fail the check too (exit 1)
--script <choice>       init: writing system of a language with two real orthographies, e.g. crk=Cans
--name <code=name>      init: display name of a language with no card (a private-use code), e.g. qaa="Ayta (variety not yet confirmed)"
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

### Een taalpaar noteren

Een projectpaar wordt geschreven zoals `champollion.config.json` het indexeert: `en:fr`. `sync`, `verify` en `serve` lezen ook `en>fr` en `en-fr`, en `en-pt-BR` wordt vergeleken met de paren die u hebt geconfigureerd. De netwerkcommando's (`network register-corpus`, `leaderboard`, `recommend`, `submit`) schrijven een paar als `eng>crk`, de vorm die het leaderboard opslaat en `mt-eval` gebruikt, en lezen `eng-crk` en `eng:crk` op dezelfde manier. Met uitsluitend koppeltekens bestaat een paar uit twee codes van twee of drie letters (`eng-crk`). Een code met een eigen koppelteken vereist `>`: `--pair "eng>pt-BR"`. `eng-pt-BR` wordt geweigerd en nooit geraden. Plaats de `>`-vorm tussen aanhalingstekens in een shell: zonder aanhalingstekens stuurt `--pair eng>crk` de uitvoer naar een bestand genaamd `crk`.

---

## init

Interactieve installatiewizard die `champollion.config.json` aanmaakt. Begeleidt u door de bronlocale, doeltalen, bestandsindeling en vertaalmodel.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
champollion init --yes --langs crk --content-dir newsletters  # also translate a folder of Markdown
champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false
```

**Optie `--content-dir`**: Een map met Markdown/MDX-bestanden die naast uw locale-bestanden moet worden vertaald (genoteerd als `contentDir`). De map moet bestaan; `init` stopt zonder iets te schrijven als dat niet het geval is.

**Een project met een local-only-bestand valt standaard terug op `local`**: De standaardmethode is `llm` (OpenRouter, een gehoste dienst). Wanneer een bestand ergens in het project als local-only is gemarkeerd — met een `<file>.champollion.json` ernaast met `"transmission": "local-only"`, zoals `champollion network register-corpus --data <file> --tier local-only` schrijft — valt `init` (evenals `--yes`) standaard terug op de `local`-methode: een model dat op deze machine wordt geserveerd (Ollama's standaard `http://localhost:11434/v1`, of de server die `LOCAL_API_BASE` noemt). Het geeft aan waarom, onder vermelding van het gemarkeerde bestand, en legt uit hoe u bewust voor een gehoste methode kunt kiezen: `champollion init --force --method llm --model <model>`. Een expliciete `--method` heeft altijd voorrang; `init` vermeldt het gemarkeerde bestand vervolgens naast de plaats waar de tekst naartoe gaat.

**`init` opnieuw uitvoeren (`--force`)**: Zonder `--force` stopt `init` wanneer `champollion.config.json` al bestaat. Met deze vlag start `init` vanuit dat bestand en herschrijft het alleen wat de vlaggen aangeven: `--langs` stelt de doellijst in (een taal die er al in staat, behoudt haar vermelding — register, schrift, naam), `--method` de standaardmethode (en het bijbehorende model, tenzij `--model` er een noemt), `--model`, `--temperature`, `--source`, `--dir`, `--format`, `--content-dir`, `--script`, `--name`, en `--method api` de paren die het noemt. Het detecteert de locale-indeling alleen opnieuw wanneer het bestand uw bronbestanden niet meer kan vinden (of wanneer `--dir` een andere map noemt). Elke andere instelling — `batchSize`, `pairs`, `glossary`, fallbacks, gekozen registers — blijft zoals deze was. Het toont elk veld dat is gewijzigd en de velden die zijn behouden, en kopieert het vorige bestand eerst naar `champollion.config.json.bak` (wanneer die back-up al een ouder bestand bevat, wordt de volgende `.bak.2`, `.bak.3` …; een oudere back-up wordt nooit overschreven). Een bestand dat geen geldige JSON is, kan niet worden behouden: er wordt een back-up van gemaakt en er wordt een nieuw bestand geschreven. Om één instelling te wijzigen, bewerkt u deze in het bestand — `init` hoeft daarvoor nooit opnieuw te worden uitgevoerd.

**Uw locale-bestanden vinden**: `init` zoekt naar het bestand van uw brontaal voordat het iets schrijft. Het controleert eerst de gebruikelijke map van uw framework (next-intl `messages/`, i18next `public/locales/<lang>/` en vervolgens `locales/<lang>/`, vue-i18n `src/locales/`, Hugo `i18n/`), daarna `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` en `src/i18n`, en toont wat het heeft gevonden. Het schrijft nooit een `localesDir` die niet bestaat. Zie [Locale-bestandsindelingen](/docs/getting-started/configuration#locale-layouts).

**Optie `--langs`**: Door komma's gescheiden lijst van doeltaalcodes. Slaat de taalprompt over en past de standaard register-voorinstelling van elke taal toe — weggeschreven in de configuratie, zodat de keuze zichtbaar en bewerkbaar is: `"languages": { "fr": "formal-vous", "es": "neutral-latam" }` (verander deze naar een andere voorinstelling of naar uw eigen bewoordingen die de toon beschrijven; een taal zonder voorinstellingen wordt geschreven als `{}`). Het maakt ook de lege doelbestanden aan in uw indeling (`fr.json`, of `fr/common.json` voor elke namespace). Combineer met `--yes` voor een volledig niet-interactieve configuratie.

**`--method api --endpoint <url>`**: Een server die het API-contract van champollion volgt — bijvoorbeeld een model dat u zelf hebt getraind, geserveerd door `nmt-forge serve`. `init` schrijft één paar per doel, dezelfde vermelding als het `DEPLOY.md` naast het model: `"pairs": { "en:abc": { "method": "api", "endpoint": "http://127.0.0.1:8378/translate", "acceptsInstructions": false } }`. `--accepts-instructions true|false` geeft aan of het eindpunt instructies per sleutel volgt (een model dat met nmt-forge is getraind doet dat niet); zonder dit veld neemt `init` de waarde over van een geïnstalleerd plugin-manifest voor hetzelfde eindpunt (`.champollion/methods/<name>/method.json`), of laat het onvermeld. Het heeft `--langs` nodig (het eindpunt wordt per paar ingesteld), en een sleutel alleen voor een eindpunt buiten deze machine (`CHAMPOLLION_API_KEY`). Voeg handmatig een `fallback`-methode toe aan het paar, zoals `DEPLOY.md` laat zien.

**Optie `--script`**: Enkele talen worden in meer dan één officiële orthografie geschreven — Plains Cree (`crk`: `Latn` = Standard Roman Orthography, `Cans` = Syllabics), Servisch (`sr`: `Latn`, `Cyrl`). Champollion maakt hierin geen keuze voor een taalgemeenschap: `sync` weigert zo'n taal te vertalen totdat de configuratie er een specificeert. De wizard vraagt hiernaar; geef met `--yes` `--script crk=Cans` door (meerdere: `--script crk=Cans,sr=Latn`; bij een enkele doeltaal volstaat `--script Cans`), wat `"languages": { "crk": { "script": "Cans" } }` schrijft. Zonder dit geeft `init --yes` aan welke talen een keuze vereisen, somt het de keuzes op en toont het de `"script"`-regel die u aan de vermelding van die taal in de configuratie moet toevoegen.

**Optie `--name`**: Een private-use-code (`qaa`–`qtz`, voor een taalvariant zonder bevestigde code) heeft geen taalkaart, dus meldt `init` dit in plaats van u te vragen de spelling te controleren. `--name qaa="Ayta (variety not yet confirmed)"` kent hieraan de weergavenaam toe die prompts en rapporten gebruiken, geschreven als `"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }` (meerdere: `--name "qaa=…;qab=…"`). Naast elk register toont `init` ook de genderinstructies die LLM-prompts voor de taal bevatten ([Genderinstructies](/docs/getting-started/configuration#gender-guidance)).

**Taalvoorinstellingen**: Wanneer u wordt gevraagd naar doeltalen, kunt u namen van voorinstellingen typen:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Combineer voorinstellingen en afzonderlijke codes: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Vertaalt ontbrekende en verouderde sleutels in alle localebestanden. Voert standaard na afloop een verificatie uit.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --redo keys:hero.title            # translate one key again (cache still serves)
champollion sync --redo "keys:a.title,a.subtitle"   # several keys
champollion sync --redo 'keys:Welcome\, %(name)s'  # a key with a comma in it (gettext)
champollion sync --pair en:tlh --redo all           # rebuild one whole locale
champollion sync --pair en:tlh --redo all --fresh   # ...bypassing a suspect cache (billed)
champollion sync --redo content                     # re-process all Markdown/MDX (cached text is free; reviewers' edits are kept)
champollion sync --files "docs/guides/**"           # only these content files
champollion sync --redo files:docs/intro.md --fresh # translate one file from scratch (billed)
champollion sync --redo gaps                        # ask again for plural forms a model left out
champollion sync --prune plural-extras              # remove plural keys for forms a language does not have
champollion sync --content-dir ./newsletters       # include a folder of Markdown (Hugo content/ or any folder)
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Translation Memory**: Standaard laadt `sync` `.champollion/tm.json` en levert het gecachte vertalingen voor ongewijzigde bronwaarden. Overschakelen naar een ander model gooit dat niet weg: tekst die al onder het vorige model is vertaald, wordt kosteloos hergebruikt, en sync meldt dit vóór de kostenraming. Om ze door het nieuwe model te laten vertalen: `--redo all --fresh-on-model-change` — dit verstuurt de sleutels die een eerder model heeft vertaald, terwijl wat het nieuwe model al heeft vertaald nog steeds uit de cache komt (op zichzelf heeft `--fresh-on-model-change` alleen invloed op sleutels die de run sowieso vertaalt). Gebruik `--no-tm` om de cache volledig te omzeilen (handig bij het debuggen van de kwaliteit). Zie [Translation Memory](/docs/concepts/translation-memory).

**Kostenraming en `--max-cost`**: De raming berekent alleen de kosten van wat tijdens de run wordt gefactureerd. Sleutels, front-matter-velden en Markdown-blokken die al in het Translation Memory aanwezig zijn, worden gewaardeerd op $0, en de tabel toont wat de cache bespaart. Een model dat op deze machine wordt geserveerd (`local`, of een `api`-eindpunt op `localhost`/`127.0.0.1`/`::1`) toont `$0 (local)` — geen API-factuur; uw hardware en stroomverbruik worden niet meegeteld. `--max-cost` toetst aan dat bedrag. Boven het limietbedrag, of wanneer er geen raming is (een methode zonder gepubliceerde prijs, zoals `local` gericht op een andere machine), stopt sync vóór elke API-aanroep en sluit af met exitcode `2`; er wordt niets vertaald of geschreven. De afsluitende regel meldt hoeveel sleutels naar het model zijn verzonden en hoeveel er uit de cache kwamen.

Onder de tabel vermeldt één regel het tarief waarmee het bedrag is berekend en waar dit vandaan kwam — voor een gehost model de prijs per 1M invoer- en uitvoertokens uit de openbare prijslijst van OpenRouter, en wanneer deze is gelezen (`Rate: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`); voor een directe provider (`openai`, `anthropic`, `gemini`) dient dezelfde lijst als vervanging voor de eigen prijs van de provider, en wanneer de lijst niet kan worden gelezen (of geen prijs voor het model bevat), wordt een in champollion bewaarde kopie gebruikt, inclusief de datum waarop deze voor het laatst is gecontroleerd en waarom; DeepL, Google en Microsoft op basis van hun gepubliceerde prijs per teken, met datum. Het is een schatting: de regel geeft aan van hoeveel tokens (of tekens) per sleutel wordt uitgegaan, en de uiteindelijke factuur hangt af van de werkelijke lengtes. Met `--json` bevat de raming de details: de `rate` van elk paar en de `rates` van de run (`inputPerMillion`, `outputPerMillion` of `perMillionChars`, `tokensPerKey`, `from`, `url`, `fetchedAt` of `verified`).

**Het verzoek bekijken**: `sync --dry --show-prompt [key]` toont het exacte verzoek dat naar de methode van het paar zou worden verzonden — de systeem- en gebruikersberichten (of, voor een `api`-eindpunt, de request body), samengesteld door de eigen code van de methode, met afgeschermde API-sleutels — en verzendt niets. Met een sleutel (benoemd zoals `--redo keys:` deze noemt: `verb␄Open`, `common::nav.home`; een gettext-msgid met een komma kan in zijn geheel worden opgegeven) toont het het verzoek voor die sleutel, ongeacht of deze in de wachtrij staat. Wanneer een echte run er niets voor zou verzenden (omdat deze actueel is, uit de cache wordt geserveerd of wordt tegengehouden), meldt het dit en noemt het het `--redo keys:<key> --fresh`-commando dat het wel zou verzenden. Zonder sleutel toont het de eerste batch die elk bestand zou verzenden, of meldt het dat er niets zou worden verzonden. Zo kunt u controleren of een gettext-`msgctxt`, een `#.`-opmerking of een ARB-beschrijving het model bereikt. Naar machinevertalingsengines (DeepL, Google…) wordt uitsluitend de brontekst verzonden; de preview vermeldt dit. Met `--json` is elk verzoek een `{"level": "event", "event": "request", …}`-regel.

**Dry runs**: `--dry` vertaalt niets en schrijft niets, maar controleert eerst wat de echte run zou controleren: wanneer een sleutel die de methode nodig heeft ontbreekt (`OPENROUTER_API_KEY`, `DEEPL_API_KEY`, …), waarschuwt het dat de echte run zou stoppen en noemt het de variabele. Het controleert of de sleutel is ingesteld, niet of deze werkt: er wordt niets verzonden, dus een placeholder wordt geaccepteerd. Het sluit alsnog af met code `0` — een preview faalt nooit (zie [exitcodes](#sync-exit-codes)). Hetzelfde geldt voor `--max-cost`: een dry run stopt niet bij het limietbedrag, maar wanneer de raming erboven ligt (of onbekend is), meldt het eenmalig aan het einde dat de echte run daar zou stoppen en zou afsluiten met `2`. Met `--json` is elke regel één JSON-object met een `level` (`info`, `ok`, `event` op stdout; `warn`, `error` op stderr), en de laatste stdout-regel is de samenvatting, `{"level": "summary", "command": "sync", …}`, met daarin `preflight: { ready, failures }`, met een limiet `maxCost: { cap, estimatedCost, wouldStop, exitCode }`, en `realRun: { exitCode, wouldStop, reasons }` — de exitcode waarmee de echte run zou eindigen, voor zover een preview dat kan bepalen (zie [exitcodes](#sync-exit-codes)). Voer dit uit met de vlaggen die de echte sync gebruikt (`--method`, `--model`): zonder deze vlaggen controleert het de methode die de configuratie noemt. De eigen exitcode van een dry run laat een CI-stap nooit falen; de `--max-cost`-waarschuwing legt daarom uit hoe u een controlepoort kunt inrichten: lees `maxCost.wouldStop` (of `realRun.exitCode`) uit de `--json`-samenvatting — bijvoorbeeld `jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)'`. De [controlestap in de CI-handleiding](/docs/guides/ci-cd#check-before-sync) doet dat en toont bij falen de reden (`realRun.reasons`) in plaats van alleen een kale `false`. De `totalPluralGaps` van de dry run telt de meervoudsberichten op schijf die een vorm missen die de taal gebruikt en die de echte run niet opnieuw zou opvragen, en `verify` is `{ "ran": false }` (er is niets geschreven, dus er is niets geverifieerd).

**Opnieuw vertalen**: `--redo` geeft aan *wat* opnieuw moet worden vertaald en `--fresh` geeft aan *of daarvoor betaald moet worden*. Zonder `--fresh` wordt alles wat al in de cache staat gratis teruggegeven (en passeert het nog steeds de kwaliteitscontrole); met deze vlag wordt alles in de wachtrij opnieuw vertaald en gefactureerd. De oudere vlaggen (`--force`, `--force-keys`, `--force-content`, `--retranslate`, `--no-tm`) werken nog steeds en betekenen precies wat de tabel vermeldt.

**Bereik beperken tot bestanden**: `--files` beperkt de contentstap tot overeenkomende bestanden, en `--redo files:<glob> --fresh` dwingt nieuwe vertalingen af voor overeenkomende bestanden (de enige opzettelijke heruitgave). Patronen komen overeen met de paden die sync toont (relatief ten opzichte van de `contentDir`, `2026-10.md`) en hetzelfde pad vanaf de hoofdmap van het project (`newsletter/2026-10.md`): `*` blijft binnen een map en `**` overschrijdt mappen. Beide vlaggen kunnen worden herhaald. Een patroon dat met geen enkel bestand overeenkomt, stopt de run voordat er kosten worden gemaakt. De sleutel-waardestap is al incrementeel en wordt zoals gebruikelijk uitgevoerd.

**Fouten**: Als één contentbestand faalt, stopt dat de andere bestanden niet. Bestanden die zijn geslaagd worden geregistreerd en de vertalingen ervan worden gecachet, en de run eindigt met een lijst van mislukte bestanden en de status waarin elk is achtergelaten. Een bestandsregel geeft nooit `[OK]` aan wanneer er sleutels in niet zijn vertaald. De foutensamenvatting geeft per sleutel aan wat de volgende sync doet: vraagt opnieuw aan (geen bruikbaar antwoord), vraagt nog eenmaal aan (in behandeling na een redo), of houdt deze tegen (geweigerd door de kwaliteitscontrole). Markdown-blokken en front-matter-velden die door de controle zijn geweigerd, worden op dezelfde manier per pagina tegengehouden; `--redo files:<page>` of `--redo content` vraagt ze opnieuw aan ([Kwaliteitscontrole](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). De exitcode is `0` (alles in orde), `2` (gedeeltelijk: een deel van het werk is voltooid, iets is mislukt, tegengehouden of niet geverifieerd, er is een meervoudsbericht geschreven zonder een vorm die de taal gebruikt voor reguliere aantallen — of gestopt door `--max-cost` voordat er kosten zijn gemaakt) of `1` (niets geslaagd).

**Wijzigingsdetectie**: champollion slaat SHA-256-hashes op in `.champollion.lock`. Wanneer bronwaarden veranderen, vertaalt de volgende sync die sleutels automatisch opnieuw. Commit het lock-bestand zodat alle ontwikkelaars dezelfde basislijn delen. Het lock-bestand legt per doellocale ook een vingerafdruk vast van elke waarde die door sync is geschreven (zodat een waarde die door een persoon is bewerkt wordt herkend en behouden bij bulksgewijze hervertalingen — [Vertalingen bewerken](/docs/guides/professional-translators#editing-key-value-files)), de sleutels die een redo niet kon voltooien (**in behandeling**: de volgende sync vraagt ze nog eenmaal aan) en de sleutels die de kwaliteitscontrole heeft geweigerd (**tegengehouden**: worden bij een standaard sync niet opnieuw naar hetzelfde model gestuurd — [Kwaliteitscontrole](/docs/concepts/quality-gate#refused-keys-are-held-back)).

**Handmatige bewerkingen en hervertalingen**: `--redo all`, `--force` en een modelwissel behouden waarden die door een persoon zijn bewerkt, en geven aan welke; `--redo keys:<key>` met vermelding van een sleutel vervangt deze; een sleutel waarvan de bron is gewijzigd, wordt opnieuw vertaald. Een vervangen bewerking wordt getoond en toegevoegd aan `.champollion-replaced-edits.jsonl` (bijgehouden — commit dit samen met het lock-bestand).

**gettext-sleutels met een context**: een sleutel is `msgctxt` + U+0004 + `msgid`. Rapporten tonen het scheidingsteken als `␄`, wat door `--redo keys:` en `--force-keys` weer wordt geaccepteerd; om dit in te voeren schrijft u `\x04`: `--redo 'keys:django::verb\x04Open'` (enkele aanhalingstekens behouden de backslash). Beide schrijfwijzen werken. Herstelcommando's tonen de `␄`-vorm, gevolgd door shell-commentaar met de naam van `\x04`.

**Een opgegeven sleutel die nergens mee overeenkomt**: `--redo keys:` / `--force-keys` met een naam die in geen enkele bronsleutel voorkomt (een typfout, of een msgid die alleen met een context bestaat) mislukt met exitcode 1. De foutmelding toont de meest overeenkomende sleutels, inclusief elke contextvariant van die msgid, in beide schrijfwijzen. Wanneer geen van de namen overeenkomt, wordt er niets uitgevoerd. Wanneer sommige overeenkomen, worden die opnieuw gedaan, waarna de run mislukt onder vermelding van de overige.

**Een opgegeven sleutel geleverd uit de cache**: zonder `--fresh` levert een redo wat er in de cache staat (opnieuw gecontroleerd, zonder kosten) en meldt dit, samen met het `--fresh`-commando dat het model opnieuw raadpleegt en de bijbehorende kosten.

**Parallellisme**: Zowel de vertaling van JSON-sleutels als de inhoudsvertaling worden parallel uitgevoerd. JSON-locales worden gelijktijdig vertaald (standaard: 200 gelijktijdige locales), waarbij batches binnen elke locale ook geparallelliseerd worden (4 gelijktijdige batches). Inhoudsvertaling (Markdown, MDX, blogberichten) wordt uitgevoerd in een platte werkitempool (standaard: 48 gelijktijdige API-aanroepen). Overschrijf met `--json-concurrency`, `--content-concurrency` of `--concurrency` (stelt beide in).

**Uitvoer**: Sync toont een versiebanner, detectie van indeling/framework, kostenraming en voortgangsbalken per locale:

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

Voortgangsbalken worden ter plekke bijgewerkt na elke batch (~80 sleutels). Gebruik `--quiet` voor uitsluitend fouten/waarschuwingen, of `--json` voor machineleesbare NDJSON-uitvoer. Beide onderdrukken de voortgangsbalk en de banner. Met `--json` wordt een `cost`-event verzonden vóór de `--max-cost`-controlepoort, een `file`-event voor elk contentbestand en elke locale, en sluit een `summary` elke run af.

### Exitcodes {#sync-exit-codes}

| Code | Een echte run | Een dry run (`--dry`) |
|------|---------------|-------------------------------|
| `0` | Alles in de wachtrij is vertaald en geverifieerd, of er stond niets in de wachtrij. | Is uitgevoerd — zelfs wanneer wordt aangegeven dat de echte run zou stoppen. |
| `2` | Gedeeltelijk: een deel van het werk is gedaan, maar er is iets mislukt, tegengehouden of niet geverifieerd, of er is een meervoudsbericht geschreven zonder een vorm die de taal gebruikt voor reguliere aantallen. Tevens: `--max-cost` heeft de run gestopt voordat er iets werd verzonden. | Nooit. |
| `1` | Niets is geslaagd, of de run kon niet starten: een sleutel die de methode vereist ontbreekt, een modelserver die de run vereist antwoordt niet, een voor redo opgegeven sleutel komt nergens mee overeen, een `--files`-patroon komt met geen enkel bestand overeen, of de configuratie is ongeldig. | De dry run zelf kon niet worden uitgevoerd: een voor redo opgegeven sleutel komt nergens mee overeen, een `--files`-patroon komt met geen enkel bestand overeen, of de configuratie is ongeldig. |

Een dry run sluit opzettelijk af met `0`: het is de preview die u uitvoert voordat u een beslissing neemt, en een CI-stap die alleen inspecteert mag niet falen. Wat de echte run zou doen, staat in de laatste regels van de dry run en in de `--json`-samenvatting: `preflight.ready: false` betekent dat de echte run zou stoppen vóór het vertalen en zou afsluiten met `1` (`preflight.failures` vermeldt waarom); `maxCost.wouldStop: true` betekent dat deze zou stoppen bij het limietbedrag en zou afsluiten met `2` (`maxCost.exitCode: 2`); `maxCost.exitCode: 1`, met `maxCost.stopsEarlier`, betekent dat de preflight-controle deze zou stoppen voordat het limietbedrag wordt gecontroleerd. `realRun.exitCode` combineert deze met wat de echte run gedeeltelijk zou achterlaten: tegengehouden sleutels, of meervoudsberichten op schijf zonder een vorm die de taal gebruikt en die niet opnieuw zou worden opgevraagd (`2`; `realRun.reasons` noemt ze, en de laatste regel van de dry run meldt dit). Een weigering door de kwaliteitscontrole of een mislukte verificatie, wat alleen de echte run kan ontdekken, kan een voorspelde `0` alsnog veranderen in een `2`. De [controlestap in de CI-handleiding](/docs/guides/ci-cd#check-before-sync) zet deze om in een falende CI-stap die de reden toont.

---

## watch

Synchroniseert automatisch wanneer het bronlocalebestand wijzigt. Wordt uitgevoerd totdat het wordt onderbroken met `Ctrl+C`.

```bash
champollion watch
```

---

## audit

De controlepoort voor volledigheid. Geeft een overzicht van elke sleutel die niet is vertaald — ontbrekend, leeg of nog steeds een `[EN]`-fallback — en elke vertaling die **verouderd** is: gemaakt op basis van een oudere brontekst dan de huidige (volgens `.champollion.lock`; een bewerking van de bron waarvan de hervertaling is mislukt, levert precies dit op). Elke lijst met verouderde vertalingen eindigt met het commando dat deze opnieuw vertaalt. Sluit af met code 1 als er problemen worden aangetroffen — gebruik dit als CI-controlepoort om builds met onvolledige of verouderde vertalingen te laten falen.

```bash
champollion audit
champollion audit --json   # summary carries untranslatedKeys and outOfDateKeys per locale
```

---

## verify

Leest alle localebestanden opnieuw van schijf en controleert of vertalingen daadwerkelijk aanwezig en correct zijn. Dit is dezelfde verificatie die automatisch wordt uitgevoerd aan het einde van elke `sync` (tenzij `--no-verify` wordt meegegeven).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify --strict           # warnings fail too
champollion verify && echo "All good" # CI gate
champollion verify --json             # one "verify" record per locale (NDJSON)
```

**Wat het controleert:**
- Sleutelpariteit — alle bronsleutels aanwezig in elk doel (voor i18next-meervoudssleutels de sleutels van de eigen CLDR-meervoudsvormen van de locale: Frans vereist ook `count_many`)
- `[EN]` fallback-markeringen van eerdere runs
- Lege vertalingen
- Schriftconformiteit — een niet-Latijnse locale mag geen uitsluitend Latijnse tekst bevatten; letters worden geclassificeerd op basis van Unicode-schrift, dus Latijnse letters met accenten en fullwidth-Latijn tellen mee als Latijn. Fullwidth-Latijnse letters zijn een fout in elke locale buiten CJK-typografie
- Placeholders, waarbij elke bevinding wordt benoemd volgens de betrokken syntaxis — ICU MessageFormat-structuur (`ICU structure error`: een `{name}`-argument, een vertaald trefwoord of selector voor plural/select, een verloren `#`), printf-conversies (`printf/python-format placeholder mismatch`: `%s`, `%d`, `%(name)s` — een verloren `%(name)s` van een gettext-catalogus wordt aangeduid als printf, niet als ICU), i18next-interpolatie (`i18next {{…}} placeholder mismatch`: `{{name}}`, inclusief `{{name}}` geschreven als `{name}`, wat i18next ongewijzigd afdrukt), en een `{name}` met enkele accolades buiten een ICU-bericht (`{…} placeholder mismatch`)
- Opmaak — per tagnaam dezelfde openings-, sluitings- en zelfsluitende tags als de bron, op dezelfde wijze genest (een verloren `</strong>` is een fout)
- Coderingsproblemen — BOM-markeringen, onzichtbare tekens
- Bronecho's — waarden die identiek zijn aan de bron (waarschuwing)
- Meervoudsvormen — een meervoudsbericht zonder een vorm die de taal gebruikt voor reguliere aantallen (Russisch `few`/`many`), een gettext-vermelding waarvan de vormen slechts `other` herhalen (sync markeert deze met een `# champollion:`-opmerking), een i18next-sleutel of `msgstr[n]` voor een vorm die de taal niet heeft (waarschuwingen)
- Identieke locales — twee doellocales met dezelfde tekst voor de meeste sleutels: de ene is waarschijnlijk in de taal van de andere (waarschuwing)
- Zelfde tekst, verschillende bronnen — één tekst geschreven voor verschillende bronstrings (een model dat een uit het hoofd geleerde zin herhaalt): twee duidelijk verschillende strings van meerdere woorden beantwoord met dezelfde tekst van vier of meer woorden, of anders drie of meer; een zin waarvan een eerdere sync al vaststelde dat het model deze herhaalde, telt zelfs bij één herhaling mee. Dit wordt geteld over sleutelwaarden, elke ICU plural/select-vertakking (de vertakkingen van één meervoud tellen als één bron) en de Markdown-pagina's van de locale (front-matter-velden en blokken; afgezien van `# ` en leestekens aan het einde), volgens dezelfde regel waarmee de controlepoort van `sync` dit weigert (fout)
- Verouderd — een vertaling die is gemaakt op basis van een oudere brontekst dan de huidige (hier een waarschuwing; `audit` faalt hierop)
- Een weggelaten vraag- of uitroepteken — de bron eindigt op `?` of `!` en de vertaling eindigt noch daarop noch op het equivalent van het doelschrift (`？`, `؟`, Griekse `;`, …). Een waarschuwing: sommige talen markeren een vraag met een woord of partikel

Het controleert de structuur, niet de betekenis: slagen betekent dat de sleutels, placeholders, meervoudsvormen,
opmaak en het schrift intact zijn, niet dat de tekst inhoudelijk correct is — laat een
moedertaalspreker de vertaling beoordelen voordat u erop vertrouwt.

**Welke locales.** `verify` controleert elke locale; `verify --pair en:fr` controleert
uitsluitend Frans. Na `sync --pair en:fr` dekt de controle na synchronisatie alleen de paren
die zijn uitgevoerd, geen andere. Een controle met beperkt bereik meldt dit op de afsluitende regel — `Verification
passed for fr: … intact (only en:fr was synced; champollion verify checks every
locale)` — and never "in every locale"; with `--json` die regel bevat
`checked` (de gecontroleerde locales) en `scope`.

**Meervoudsdekking.** Het blok van elke locale heeft één regel per soort meervoud dat de
bestanden bevatten — i18next-sleutels met achtervoegsel, ICU-meervoudsberichten, gettext-
`msgid_plural`-vermeldingen — waarin de vormen worden genoemd die de locale naar verwachting moet hebben
(de CLDR-meervoudscategorieën ervoor; in een gettext-catalogus de vormen waarvoor de
`Plural-Forms` een positie heeft) en of elk meervoud deze bevat:

```text
  ── fr ──────────────────────────────────────
  [OK] 7/7 keys present
  Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
```

`✗` noemt de meervouden die een vorm missen. Een vorm die alleen wordt gebruikt voor getallen boven 1000 of
voor breuken (Frans `many` in een ICU-bericht) wordt afzonderlijk vermeld: de `other`-
vorm treedt ervoor in de plaats, wat geen bevinding is. De regel is een samenvatting — een
ontbrekende vorm is ook een bevinding daarboven (een ontbrekende sleutel, een meervoudswaarschuwing).

**`--json`** schrijft één JSON-object per regel. Elke locale krijgt een record op
stdout — `{"level": "event", "event": "verify", "locale": "fr", …}` — met
`ok`, `keys` (`expected`, `present`, `missing`, `extra`), de bijbehorende `errors`,
`warnings` en `infos`, `placeholders` (elke bevinding met zijn `syntax`: `icu`,
`printf`, `i18next`, `brace` of `markup`) en `plurals` (per soort en type:
`categories`, `total`, `complete`, `incomplete`). De bevindingen zijn tevens
`error`/`warn`-regels op stderr, en de afsluitende regel behoudt het niveau en
bericht (`ok` op stdout wanneer de controle slaagt, `error` op stderr wanneer dat niet het
geval is) en bevat de tellingen voor `errors` en `warnings`. Na een sync komen dezelfde
records vóór de samenvatting van de sync zelf. (De records van een Docusaurus-project
bevatten geen `keys` of `plurals`: de UI-strings worden bestand voor bestand gecontroleerd.)

```bash
npx champollion verify --json 2>/dev/null | jq -c 'select(.event == "verify") | {locale, plurals}'
```

**Exitcode:** `1` wanneer er een fout is gevonden — of wanneer er helemaal niets kon worden
gecontroleerd (het bronbestand of de locales-map bevindt zich niet waar de configuratie naar verwijst;
de foutregel noemt het pad en de instelling), anders `0`. Waarschuwingen laten de controle
niet falen, tenzij u `--strict` meegeeft, wat afsluit met `1` bij elke waarschuwing (een CI die
bijvoorbeeld geen Russische meervouden mag leveren zonder hun `few`/`many`-vormen) en eindigt
met een `[FAIL]`-regel, nooit een `[OK]`-regel; `--warn-only` zorgt ervoor dat fouten ook afsluiten met `0`.
Een locale waarvan het aantal sleutels niet klopt, meldt dit in plaats van `[OK]`:
`8 expected, 9 present (1 extra: count_two)`.

---

## lint

Scant broncode op hardgecodeerde gebruikersgerichte teksten die i18n-vertaalaanroepen zouden moeten gebruiken. Detecteert automatisch uw framework (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found (or no source files were found)
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**Wat er wordt gedetecteerd:**
- Hardgecodeerde teksten in JSX-tekst, `placeholder`, `alt`, `aria-label`, `title`
- Bestanden met gebruikersgerichte inhoud maar zonder i18n-framework-import
- Dode sleutels — localeслeutels waarnaar geen enkel bronbestand verwijst
- Dekkingsscore — percentage teksten dat via i18n wordt verwerkt

**Uitsluitingen**: Maak `.champollionignore` aan in de hoofdmap van uw project (globpatronen, zoals `.gitignore`).

**Niets te linten is een fout**: wanneer er geen bronbestand overeenkomt (de standaardmappen van het framework — `src/`, `app/`, `pages/`, `components/` voor webprojecten — of uw `--src`), sluit lint af met `1` en noemt het de mappen en extensies waarnaar is gezocht. Een lint die niets heeft gecontroleerd mag niet slagen voor een CI-controlepoort; verwijs deze naar uw code met `--src <dir>` of `"lint": { "srcDir": "<dir>" }`.

---

## wrap

Omhult automatisch hardgecodeerde teksten die door `lint` zijn gedetecteerd in `t()`-aanroepen. Maakt automatisch back-ups voordat bestanden worden gewijzigd.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Veiligheidscontroles:**
1. Git-schoonheidscontrole (overgeslagen bij dry-run)
2. Automatische back-up naar `.champollion-backup/`
3. Diff-voorbeeld vóór elke bestandsschrijfactie
4. `--undo`-ondersteuning om te herstellen vanuit back-up

---

## seo

Genereer SEO-artefacten voor meertalige sites.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Subopdracht | Uitvoer |
|-------------|---------|
| `hreflang` | `<link rel="alternate" hreflang>`-tags |
| `sitemap` | Meertalige `sitemap.xml` |
| `jsonld` | JSON-LD WebSite-taalschema |

---

## integrity

Detecteert beschadiging en afwijkingen in vertaalde localebestanden.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**Wat het controleert:**
- Corruptie van placeholders (bijv. `{name}` aanwezig in bron maar ontbrekend in doel)
- Coderingsproblemen (mojibake, ongeldige Unicode)
- Onvertaalde kopieën (doelwaarde identiek aan bron) — [`noTranslate`](/docs/getting-started/configuration#no-translate)-sleutels zijn vrijgesteld, evenals echo's waarvan het Translation Memory bevestigt dat ze door de pipeline zijn geproduceerd en goedgekeurd door de controlepoort. Wat gemarkeerd blijft, is precies wat `sync` opnieuw in de wachtrij zou plaatsen — de twee tools kunnen niet van mening verschillen over een gezond bestand
- No-translate-drift (een `noTranslate`-sleutel die *niet* identiek is aan de bron) — gerapporteerd met verwachte/werkelijke waarden en geëscapete onzichtbare tekens; voer `champollion sync` uit om te herstellen
- Onverwachte PUA (Private Use Area-codepunten in een locale waarvan [schriftconversie](/docs/getting-started/configuration#script-conversion) is uitgeschakeld — wordt zonder speciaal lettertype blanco weergegeven); voer `champollion repair-script` uit om te herstellen
- Uitgeholde waarden (een doelwaarde die gelijk is aan de bron maar waarvan de letters zijn verwijderd — schade door een pipeline die ouder is dan de content-preservation-controle); vertaal opnieuw met `sync --force-keys <key>` of `sync --pair <pair> --force`
- Verweesde sleutels (sleutels in het doel die niet in de bron voorkomen)
- Volledigheid van ICU MessageFormat-meervoudscategorieën (bijv. Arabisch vereist 6 categorieën) — volgens dezelfde regel die `sync` en `verify` hanteren: een ontbrekende vorm die bereikt wordt door reguliere aantallen (Russisch `few`/`many`) is een waarschuwing; een vorm die alleen bereikt wordt door getallen boven 1000 of door breuken (Frans `many`, gebruikt voor 1 000 000) is een opmerking, aangezien de `other`-vorm daar wordt gebruikt

---

## repair-script

Draait schriftconversie terug die nooit had mogen plaatsvinden: PUA-gecodeerde waarden (pIqaD, Tengwar, Kryptonian) in locales waarvan de configuratie aangeeft dat conversie is uitgeschakeld, worden hersteld naar romanisatie via de eigen omkeringstabel van de convertor.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Optie | Uitwerking |
|-------|------------|
| `--dry` | Preview van herstelbewerkingen zonder te schrijven |
| `--locale <code>` | Slechts één locale herstellen |
| `--json` | Machineleesbare JSON-uitvoer |
| `--warn-only` | Afsluiten met exitcode 0, zelfs als er niet-omkeerbare PUA overblijft |

pIqaD wordt exact teruggedraaid. Bij Tengwar en Kryptonian kan het terugdraaien geen hoofdletters herstellen (gemarkeerd als case-lossy). Het Translation Memory behoeft geen herstel — het slaat waarden van vóór de conversie op. Sluit af met exitcode 1 wanneer er PUA overblijft die geen enkele geregistreerde convertor kan terugdraaien.

---

## tm

Beheer de cache van het vertaalgeheugen (`.champollion/tm.json`). TM slaat eerdere vertalingen op en levert deze bij volgende synchronisaties in plaats van de API aan te roepen.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Subopdracht | Uitvoer |
|-------------|---------|
| `stats` | Aantal vermeldingen, bestandsgrootte, uitsplitsing per locale |
| `clear` | Cachebestand verwijderen (volledig of per locale) |

| Optie | Effect |
|-------|--------|
| `--locale <code>` | Alleen vermeldingen voor één locale wissen |
| `--yes` | Bevestigingsprompt overslaan |

Zie [Vertaalgeheugen](/docs/concepts/translation-memory) voor de werking van TM en wanneer u het moet wissen.

---

## xliff

Exporteer en importeer XLIFF 1.2-bestanden voor beoordeling door professionele vertalers. XLIFF is het universele uitwisselingsformaat dat wordt ondersteund door CAT-tools zoals memoQ, SDL Trados en Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Subopdracht | Uitvoer |
|-------------|---------|
| `export` | Genereer `.xliff` vanuit bron- en doellocalebestanden |
| `import` | Beoordeelde `.xliff`-vertalingen samenvoegen in localebestanden |

| Optie | Effect |
|-------|--------|
| `--locale <code>` | Doellocale voor export (verplicht) |
| `--out <path>` | Aangepast uitvoerpad of map |
| `--dry` | Import voorvertonen zonder te schrijven |

Zie [Werken met professionele vertalers](/docs/guides/professional-translators) voor de volledige workflow.

---

## status

Toon paarconfiguratie, geïnstalleerde plugins en benchmarkscores.

Een paar waarvan de configuratie `qualityTier` instelt (`standard`, `high`, `research` of
`verified`) toont dit, aangeduid voor wat het is: een label dat u hebt gekozen, geen
meting — sync vertaalt op dezelfde wijze ongeacht wat er staat, en `serve`
maakt er melding van. Een paar dat dit niet instelt toont niets (`--json` heeft nog steeds
`qualityTier`, met `qualityTierSet: false`).

```bash
champollion status
```

Na een modelwissel meldt het ook wanneer de bestanden van een locale tekst van meer
dan één model combineren (uit het Translation Memory: welk model elke waarde
op schijf heeft gegenereerd), met het commando waarmee het huidige model de teksten vertaalt die een
eerder model heeft geschreven — `sync --pair <pair> --redo all --fresh-on-model-change`.
Voor een methode die een door u gekozen model uitvoert (`local`, `api`, `external`)
herhaalt het de licentiemelding die de eerste sync eenmalig heeft getoond. Voor een OpenAI-compatibele
methode (`local`, `openai`) toont het het adres waar verzoeken naartoe gaan en de instelling
die dit heeft gekozen: `LOCAL_API_BASE` in de omgeving of in `.env`, of de standaardwaarde
(Ollama, `http://localhost:11434/v1`). Met `contentDir` vermeldt het de contentmap
naast de sleutel-waardebestanden, inclusief het aantal bronpagina's dat deze bevat en,
per taal, hoeveel vertalingen actueel, verouderd of in behandeling zijn.
In behandeling betekent nog geen vertaling, of delen die door de kwaliteitscontrole zijn geweigerd en in de brontaal zijn achtergebleven (het content-lock-bestand vermeldt `pending:<hash>`).
Onder elk register toont het de genderinstructies die LLM-prompts bevatten en waar
deze vandaan komen (Champollions standaardwaarde voor de taal, uw configuratie, of uitgeschakeld —
zie [Genderinstructies](/docs/getting-started/configuration#gender-guidance)).
Voor een paar met een fallback telt het hoeveel waarden in de bestanden door de fallback
zijn geschreven, en noemt het de eerste paar.
`--json` bevat hetzelfde als `requestsGoTo` (bij een paar of fallback met een dergelijk eindpunt), `content`, `genderGuidance` en `fallback.valuesInFiles`.

---

## provenance

Controleert de licenties van vertaalresources voor alle geïnstalleerde plugins.

```bash
champollion provenance
```

---

## plugin

Beheer plugins voor vertaalmethoden. Plugins zijn voorverpakte vertaalrecepten die worden geïnstalleerd in `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove my-method          # remove a plugin
```

Zie [Plugin-specificatie](/docs/reference/plugin-spec) voor het pluginmanifestformaat.

---

## leaderboard

`champollion network leaderboard` (werkt ook als `champollion leaderboard`). Blader door vertaalmethoden van het Network-leaderboard, doorzoek ze en installeer ze. Methoden die zijn geïnstalleerd vanaf het leaderboard worden geleverd met benchmarkscores en de volledige canonieke MethodConfig — de exacte configuratie die tijdens de evaluatie is gebruikt.

```bash
champollion network leaderboard                       # show leaderboard
champollion network leaderboard --pair "eng>fra"      # filter by language pair (quote the >)
champollion network leaderboard --install 1           # install the method ranked 1 as a plugin
champollion network leaderboard --install 1 --apply   # install + patch config
```

| Optie | Uitwerking |
|-------|------------|
| `--pair <pair>` | Filter op taalpaar, zoals het leaderboard dit noteert: `"eng>fra"` (ISO 639-3; plaats de `>` tussen aanhalingstekens). `eng-fra` en `eng:fra` werken ook, en een 2-letterige code wordt omgezet (`en` → `eng`) |
| `--install <rank>` | Installeer de methode op die positie (zoals vermeld) als plugin |
| `--apply` | Voeg na installatie automatisch `methodPlugin` toe aan `champollion.config.json` |

**`--apply` workflow:** Wanneer u installeert met `--apply`, schrijft champollion de methodeplugin naar `.champollion/methods/` **en** past uw `champollion.config.json` aan om deze te gebruiken voor het betreffende paar. Dit is de snelste weg van "wat scoort het beste?" naar "ik gebruik het in productie."

---

## fonts

Downloadt en beheert PUA-weblettertypen voor scriptconverters van geconstrueerde talen. Talen die Private Use Area-tekens gebruiken (Klingon, Sindarin, Kryptonian) hebben aangepaste weblettertypen nodig om hun schriften weer te geven. Deze opdracht downloadt ze vanuit geverifieerde open-source-repositories.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Subopdracht | Uitvoer |
|-------------|---------|
| `list` | Toont welke PUA-lettertypen nodig zijn en hun installatiestatus |
| `install` | Downloadt lettertypen voor geconfigureerde talen |

| Optie | Effect |
|-------|--------|
| `--dir <path>` | Uitvoermap voor lettertypen overschrijven (automatisch gedetecteerd op basis van projecttype) |
| `--css` | Een `conlang-fonts.css`-fragment genereren naast de lettertypen |
| `--config <path>` | Pad naar configuratiebestand (gebruikt om te detecteren welke talen lettertypen nodig hebben) |

**Automatische detectie:** De uitvoermap wordt afgeleid uit uw projectstructuur:
- **Docusaurus** → `static/fonts/` of `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Standaard** → `public/fonts/`

**Systeemeigen Unicode-converters** (`crk` → Cree-syllabeschrift, `sr` → Servisch Cyrillisch) vereisen GEEN lettertype-installatie.

Zie [Contalen, schriften & orthografie](/docs/guides/conlangs-scripts-orthography) voor volledige details over PUA-lettertypen.

## Drielaagse pijplijn

Gebruik `lint`, `sync` en `audit` samen voor een waterdichte i18n-aanpak:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Laag | Opdracht | Wanneer | Doel |
|------|----------|---------|------|
| **Lint** | `lint` | Pre-commit | Commits met hardgecodeerde teksten blokkeren |
| **Sync** | `sync` | Na commit / CI | Ontbrekende en gewijzigde sleutels vertalen |
| **Verify** | `verify` | Na sync / CI | Bevestigen dat vertalingen aanwezig en correct zijn |
| **Audit** | `audit` | Bouwstap | Implementatie laten mislukken als een locale `[EN]`-markeringen bevat |

---

## Zie ook

- [Configuratie](/docs/getting-started/configuration) — referentie voor het configuratiebestand
- [Vertaalmethoden](/docs/guides/translation-methods) — methodeselectie per paar
- [Vertaalgeheugen](/docs/concepts/translation-memory) — caching en kostenbesparing
- [Werken met professionele vertalers](/docs/guides/professional-translators) — XLIFF-workflow
- [Plugin-specificatie](/docs/reference/plugin-spec) — pluginmanifestformaat
- [CI/CD-handleiding](/docs/guides/ci-cd) — CLI-opdrachten automatiseren in uw pijplijn
- [Hoe synchronisatie werkt](/docs/concepts/how-sync-works) — de synchronisatiepijplijn begrijpen
- [Kwaliteitsgate](/docs/concepts/quality-gate) — hoe vertalingen worden gevalideerd
