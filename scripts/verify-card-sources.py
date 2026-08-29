#!/usr/bin/env python3
"""
verify-card-sources.py — deep source-verification of language cards against
the actual upstream dumps (Glottolog, PHOIBLE, WALS, Grambank, LinguaMeta,
Wikidata harvest, ELCat, ISO 639-3) plus the atlas SSOT fact chain
(cli/data/atlas.db — the legacy champollion.db chain was retired 2026-08-18,
champollion.db retirement B7).

Written for the 2026-07-18 card source verification
(docs/CARD_SOURCE_VERIFICATION_2026-07-18.md); re-runnable any time the
cards, generators, or upstream dumps change.

Usage (repo root):
  python3 scripts/verify-card-sources.py [--tsv out.tsv] [--sample manifest.json]

Requires the gitignored upstream dumps in cli/data/ (see
cli/scripts/download-enrichment-data.mjs) and cli/data/atlas.db.
Default sample: the frozen 62-card stratified sample from 2026-07-18
(major / low-resource / isolate / sign / conlang / extinct / mid strata,
deterministic stride pick, embedded below).

Statuses: OK | MISMATCH | NA (no upstream data) | GAP (upstream has data,
card lacks the field — informational; generators are merge-only) | WARN.

Card reads go through the ONE Python adapter (mt_eval_harness.language_cards
.normalize_card) as of 2026-08-17. Adapter-derived fields (vitality,
speakerEstimates-as-list, isoType) only exist post-adapter, so the old raw
reads silently skipped those checks. MISMATCH counts can RISE versus
pre-adapter runs — that is previously-skipped checks actually running, not a
regression. The R3 run-result scan (check 13) keeps its own pristine raw
parse: normalize_card mutates the loaded dict in place.
"""
import argparse, csv, json, os, re, sqlite3, statistics, sys
from collections import defaultdict

_ap = argparse.ArgumentParser()
_ap.add_argument("--tsv", default=None, help="write full results TSV here")
_ap.add_argument("--sample", default=None, help="JSON manifest {stratum: [codes]} overriding the frozen sample")
_ap.add_argument("--json", action="store_true",
                 help="emit the machine payload on stdout and nothing else")
_args = _ap.parse_args()

# Repo root: env override, else parent of this script's directory (scripts/).
WT = os.environ.get("CHAMPOLLION_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(WT, "cli", "data")
CARDS = os.path.join(WT, "cli", "shared", "language-cards")
csv.field_size_limit(10_000_000)

# The ONE Python card adapter (arena/mt_eval_harness/language_cards.py):
# resolves attribution envelopes and bridges renames (isoLanguageType→isoType,
# endangerment→vitality, speakerEstimates envelope→list). Reading raw instead
# made the vitality/speakerEstimates/isoType checks silently verify nothing.
sys.path.insert(0, os.path.join(WT, "arena"))
from mt_eval_harness.language_cards import normalize_card, attributions  # noqa: E402

FROZEN_SAMPLE = {
 "major": [
  "arb",
  "cjy",
  "cmn",
  "eng",
  "fra",
  "fra-CA",
  "ita",
  "kor",
  "pan",
  "por-PT",
  "spa-MX",
  "tha"
 ],
 "lowres": [
  "aaa",
  "bbu",
  "cae",
  "crk",
  "duf",
  "hiw",
  "kia",
  "ldo",
  "mmf",
  "nke",
  "pmn",
  "smm",
  "tpz",
  "wrs"
 ],
 "isolate": [
  "akc",
  "cas",
  "gbu",
  "khh",
  "mqf",
  "prm",
  "svs",
  "ulf"
 ],
 "sign": [
  "ads",
  "csd",
  "fcs",
  "iks",
  "lsb",
  "ncs",
  "rib",
  "syy"
 ],
 "conlang": [
  "afh",
  "epo",
  "ina",
  "lfn",
  "rmv",
  "tzl"
 ],
 "extinct": [
  "aaq",
  "cup",
  "ims",
  "nlw",
  "pmd",
  "try",
  "xar",
  "xpt"
 ],
 "mid": [
  "aab",
  "dil",
  "kfs",
  "nda",
  "ssc",
  "yor"
 ]
}

sample = json.load(open(_args.sample)) if _args.sample else FROZEN_SAMPLE
all_codes = [(c, s) for s, codes in sample.items() for c in codes]
# ── Load upstreams ──────────────────────────────────────────────────────────
print("loading upstreams...", file=sys.stderr)

# Glottolog languoid.csv
languoid = {}
languoid_by_iso = {}
with open(os.path.join(DATA, "glottolog", "languoid.csv")) as f:
    for row in csv.DictReader(f):
        languoid[row["id"]] = row
        iso = row.get("iso639P3code", "")
        if iso and row.get("level") == "language":
            languoid_by_iso[iso] = row

# PHOIBLE — the atlas aggregation inputs (CLDF parameters/values/languages).
# The atlas rule (cli/scripts/cldf/ingest-aggregate.mjs) counts DISTINCT
# segment parameters per SegmentClass across ALL contributing inventories —
# not the retired enrich-phoible-phonemes median. Reproduce that rule from the
# same pinned files the ingest reads, so the checker and the build can only
# disagree when one of them is wrong.
_ph_class = {}
with open(os.path.join(DATA, "phoible", "parameters.csv")) as f:
    for row in csv.DictReader(f):
        _ph_class[row["ID"]] = row.get("SegmentClass", "")
_ph_lang_iso = {}
with open(os.path.join(DATA, "phoible", "languages.csv")) as f:
    for row in csv.DictReader(f):
        # The ingest resolves via the spine: ISO first, then Glottocode
        # (PHOIBLE rows can carry a Glottocode with no ISO — e.g. nlw, pmd).
        iso = row.get("ISO639P3code") \
            or languoid.get(row.get("Glottocode", ""), {}).get("iso639P3code", "")
        if iso:
            _ph_lang_iso[row["ID"]] = iso
phoible_sets = defaultdict(lambda: defaultdict(set))  # iso -> class -> {Parameter_ID}
with open(os.path.join(DATA, "phoible", "values.csv")) as f:
    for row in csv.DictReader(f):
        iso = _ph_lang_iso.get(row["Language_ID"])
        if not iso:
            continue
        sc = _ph_class.get(row["Parameter_ID"], "")
        if sc in ("consonant", "vowel", "tone"):
            phoible_sets[iso][sc].add(row["Parameter_ID"])

def phoible_expected(iso):
    """Atlas-rule recount: distinct segments per class across all inventories."""
    groups = phoible_sets.get(iso)
    if not groups:
        return None
    c = len(groups.get("consonant", ()))
    v = len(groups.get("vowel", ()))
    t = len(groups.get("tone", ()))
    return {"consonants": c, "vowels": v, "tones": t, "totalPhonemes": c + v + t,
            "hasTone": t > 0,
            "perClass": {"consonant": c, "vowel": v, "tone": t}}

# WALS
wals_lang_by_iso = {}
wals_lang_by_glotto = {}
with open(os.path.join(DATA, "wals", "languages.csv")) as f:
    for row in csv.DictReader(f):
        for iso in (row.get("ISO_codes") or "").split():
            wals_lang_by_iso.setdefault(iso, []).append(row["ID"])
        if row.get("Glottocode"):
            wals_lang_by_glotto.setdefault(row["Glottocode"], []).append(row["ID"])
wals_values = defaultdict(dict)  # wals_lang_id -> param -> code number
with open(os.path.join(DATA, "wals", "values.csv")) as f:
    for row in csv.DictReader(f):
        wals_values[row["Language_ID"]][row["Parameter_ID"]] = row["Value"]
wals_code_names = {}
with open(os.path.join(DATA, "wals", "codes.csv")) as f:
    for row in csv.DictReader(f):
        wals_code_names[(row["Parameter_ID"], row["Number"])] = row["Name"]

def wals_feature(card, param):
    """All WALS values for this card's language for one parameter (decoded names)."""
    ids = []
    iso = card.get("iso639_3") or card.get("code")
    ids += wals_lang_by_iso.get(iso, [])
    gc = card.get("glottocode")
    if gc:
        ids += [i for i in wals_lang_by_glotto.get(gc, []) if i not in ids]
    vals = set()
    for lid in ids:
        v = wals_values.get(lid, {}).get(param)
        if v:
            vals.add(wals_code_names.get((param, v), v))
    return vals

# Grambank word order attested features (for cards without WALS 81A)
grambank_vals = defaultdict(dict)
with open(os.path.join(DATA, "grambank", "values.csv")) as f:
    for row in csv.DictReader(f):
        if row["Parameter_ID"] in ("GB130", "GB131", "GB132", "GB133"):
            grambank_vals[row["Language_ID"]][row["Parameter_ID"]] = row["Value"]

# LinguaMeta
lm_by_iso = {}
with open(os.path.join(DATA, "linguameta", "linguameta.tsv")) as f:
    for row in csv.DictReader(f, delimiter="\t"):
        iso = row.get("iso_639_3_code")
        if iso:
            lm_by_iso[iso] = row

# Wikidata SPARQL dump: iso -> set of speaker values, endangerment labels
wd_speakers = defaultdict(set)
wd_endanger = defaultdict(set)
wd = json.load(open(os.path.join(DATA, "wikidata-languages-full.json")))
for b in wd["results"]["bindings"]:
    iso = b.get("iso", {}).get("value")
    if not iso:
        continue
    if "speakers" in b:
        try:
            wd_speakers[iso].add(int(float(b["speakers"]["value"])))
        except ValueError:
            pass
    if "endangermentLabel" in b:
        wd_endanger[iso].add(b["endangermentLabel"]["value"])

# Glottolog AES
aes_by_glotto = {}
with open(os.path.join(DATA, "glottolog", "aes-values.csv")) as f:
    for row in csv.DictReader(f):
        aes_by_glotto[row["Language_ID"]] = row
AES_LABELS = {1: "not endangered", 2: "threatened", 3: "shifting",
              4: "moribund", 5: "nearly extinct", 6: "extinct"}

# ELCat
elcat_by_iso, elcat_by_glotto = {}, {}
with open(os.path.join(DATA, "elcat", "languages.csv")) as f:
    for row in csv.DictReader(f):
        if row.get("ISO639P3code"):
            elcat_by_iso.setdefault(row["ISO639P3code"], []).append(row)
        if row.get("Glottocode"):
            elcat_by_glotto.setdefault(row["Glottocode"], []).append(row)
elcat_values = defaultdict(list)  # elcat lang id -> list of (param, value, comment, preferred)
with open(os.path.join(DATA, "elcat", "values.csv")) as f:
    for row in csv.DictReader(f):
        if row["Parameter_ID"] in ("LEI", "speakers", "speaker_number", "vitality"):
            elcat_values[row["Language_ID"]].append(
                (row["Parameter_ID"], row["Value"], row.get("Comment", ""), row.get("preferred", "")))

def elcat_preferred_lei(iso, gc):
    """ELCat's own preferred LEI value(s) for this language (upstream truth)."""
    rows_ = elcat_by_iso.get(iso, []) or (elcat_by_glotto.get(gc, []) if gc else [])
    out = []
    for r in rows_:
        pref = [v for p, v, _, pf in elcat_values.get(r["ID"], []) if p == "LEI" and pf == "yes"]
        out += pref
    return out

# ISO 639-3 table
iso3 = {}
with open(os.path.join(DATA, "iso639-3", "iso-639-3.tab")) as f:
    for row in csv.DictReader(f, delimiter="\t"):
        iso3[row["Id"]] = row

# Generator's ISO15924->Unicode map, parsed straight from the .mjs.
# The generator was ARCHIVED in the 2026-08 atlas rebuild (legacy mutators)
# and current cards no longer carry scriptUnicodeName. Missing file → empty
# map, announced on stderr; if a card ever carries the field again, check 11
# then reports MISMATCH (expect=None) rather than silently passing.
script_map = {}
_sun_mjs = os.path.join(WT, "cli", "scripts", "enrich-script-unicode-names.mjs")
if os.path.exists(_sun_mjs):
    mjs = open(_sun_mjs).read()
    for m in re.finditer(r"'([A-Z][a-z]{3})':\s*'([A-Za-z_]+)'", mjs):
        script_map[m.group(1)] = m.group(2)
else:
    print("note: enrich-script-unicode-names.mjs archived — scriptUnicodeName "
          "map empty; check 11 fails loud if any card still carries the field",
          file=sys.stderr)

# Atlas SSOT facts (cli/data/atlas.db). FAIL LOUD when absent: an empty pass
# here would silently skip the whole fact-chain lane, which is exactly the
# absence-reads-as-OK failure this suite exists to prevent.
_ATLAS_DB = os.path.join(DATA, "atlas.db")
if not os.path.exists(_ATLAS_DB):
    print(f"ERROR: atlas database not found at {_ATLAS_DB}\n"
          "       Build it with: node cli/scripts/cldf/build-atlas.mjs\n"
          "       (the legacy champollion.db chain is retired — this suite "
          "verifies cards against the atlas)", file=sys.stderr)
    sys.exit(2)
db = sqlite3.connect(_ATLAS_DB)

# Parameter → card-field mapping is data (cldf_parameters.Card_Field), so the
# query below never hardcodes parameter ids per field.
_param_by_field = defaultdict(list)
for _pid, _field in db.execute("SELECT ID, Card_Field FROM cldf_parameters"):
    _param_by_field[_field].append(_pid)

def atlas_facts(code, card_field):
    """All asserted atlas values projecting into `card_field` for a language.

    Returns [(Value, Source, Comment, Derived_From)]. Subject_ID is the spine
    code (a locale card's facts live on its base language).
    """
    pids = _param_by_field.get(card_field, [])
    if not pids:
        return []
    q = ("SELECT Value, Source, Comment, Derived_From FROM cldf_values "
         f"WHERE Subject_Type='language' AND Subject_ID=? AND Status='asserted' "
         f"AND Parameter_ID IN ({','.join('?' * len(pids))})")
    return db.execute(q, (code, *pids)).fetchall()

# ── Checks ──────────────────────────────────────────────────────────────────
results = []
def emit(code, stratum, check, status, card_v, up_v, evidence=""):
    results.append({"code": code, "stratum": stratum, "check": check, "status": status,
                    "card": str(card_v)[:200], "upstream": str(up_v)[:200], "evidence": evidence[:300]})

WORD_ORDER_81A = {"SOV": "SOV", "SVO": "SVO", "VSO": "VSO", "VOS": "VOS",
                  "OVS": "OVS", "OSV": "OSV", "No dominant order": "flexible"}

for code, stratum in all_codes:
    card_path = os.path.join(CARDS, code + ".json")
    # Normalized view for every field check below; check 13 (R3) re-parses the
    # pristine JSON itself — normalize_card mutates the dict in place, so this
    # object is NOT the raw card.
    card = normalize_card(json.load(open(card_path)))
    fs = card.get("_fieldSources", {})
    iso = card.get("iso639_3") or code
    gc = card.get("glottocode")
    cls = card.get("classification") or {}

    # 1. glottocode exists + iso agreement
    if gc:
        row = languoid.get(gc)
        if not row:
            emit(code, stratum, "glottocode-exists", "MISMATCH", gc, "absent", "glottocode not in languoid.csv")
        else:
            up_iso = row.get("iso639P3code", "")
            if up_iso and up_iso != iso:
                emit(code, stratum, "glottocode-iso-agree", "MISMATCH", f"{gc}/{iso}", up_iso,
                     f"languoid {gc} carries iso {up_iso}")
            else:
                emit(code, stratum, "glottocode-exists", "OK", gc, row["name"], f"level={row['level']}")
    else:
        emit(code, stratum, "glottocode-exists", "NA", None, None, "card has no glottocode")

    # 2. family name + familyGlottocode (R5 independent). Post-atlas the family
    # is an attribution envelope when registries disagree; R5's contract is
    # that GLOTTOLOG'S OWN claim inside the envelope matches languoid.csv
    # (WALS may disagree; Glottolog may not be misquoted).
    def _glottolog_claim(v):
        if not isinstance(v, dict):
            return v
        for a in attributions(v):
            if str(a.get("source", "")).startswith("glottolog"):
                return a.get("value")
        return None
    fam = _glottolog_claim(cls.get("family"))
    fam_gc = _glottolog_claim(cls.get("familyGlottocode"))
    if gc and gc in languoid:
        row = languoid[gc]
        up_fam_id = row.get("family_id", "")
        if up_fam_id:
            up_fam_name = languoid.get(up_fam_id, {}).get("name")
            if fam_gc and fam_gc != up_fam_id:
                emit(code, stratum, "family-glottocode", "MISMATCH", fam_gc, up_fam_id, "")
            if fam and up_fam_name and fam != up_fam_name:
                emit(code, stratum, "family-name", "MISMATCH", fam, up_fam_name, f"family_id={up_fam_id}")
            elif fam:
                emit(code, stratum, "family-name", "OK", fam, up_fam_name, f"family_id={up_fam_id}")
            else:
                emit(code, stratum, "family-name", "GAP", None, up_fam_name, "card lacks family")
        else:
            # no family in glottolog: isolate or top-level family
            if card.get("isIsolate") is True or fam is None:
                emit(code, stratum, "family-name", "OK", fam, None, "no family_id in glottolog (isolate/top-level)")
            else:
                emit(code, stratum, "family-name", "WARN", fam, None,
                     f"glottolog has no family_id for {gc} but card asserts family")

    # 3. isIsolate
    if gc and gc in languoid:
        row = languoid[gc]
        up_isolate = (row.get("family_id", "") == "" and row.get("level") == "language")
        card_iso_flag = card.get("isIsolate")
        if card_iso_flag is not None and row.get("level") == "language":
            # Sign languages / conlangs may be modeled family-less without being "isolates"
            status = "OK" if bool(card_iso_flag) == up_isolate else "WARN"
            emit(code, stratum, "isIsolate", status, card_iso_flag, up_isolate, f"family_id='{row.get('family_id','')}'")

    # 4. coordinates
    coords = card.get("coordinates")
    if coords and gc and gc in languoid:
        row = languoid[gc]
        try:
            ulat, ulng = float(row["latitude"]), float(row["longitude"])
            dlat, dlng = abs(coords["lat"] - ulat), abs(coords["lng"] - ulng)
            emit(code, stratum, "coordinates", "OK" if (dlat < 0.51 and dlng < 0.51) else "MISMATCH",
                 f"{coords['lat']},{coords['lng']}", f"{ulat},{ulng}", f"src={coords.get('source')}")
        except (ValueError, KeyError, TypeError):
            emit(code, stratum, "coordinates", "NA", f"{coords.get('lat')},{coords.get('lng')}",
                 f"{row.get('latitude')},{row.get('longitude')}", "no glottolog coords")

    # 5. dialectCount + R6 provenance
    dc = card.get("dialectCount")
    lrow = languoid_by_iso.get(iso) or (languoid.get(gc) if gc and languoid.get(gc, {}).get("level") == "language" else None)
    if dc is not None:
        if lrow:
            up_dc = int(lrow.get("child_dialect_count") or 0)
            emit(code, stratum, "dialectCount", "OK" if dc == up_dc else "MISMATCH", dc, up_dc,
                 f"languoid {lrow['id']} child_dialect_count")
        else:
            emit(code, stratum, "dialectCount", "WARN", dc, None, "no language-level languoid to check")
        # R6 carve-out (2026-08): dialectCount is Glottolog's OWN
        # child_dialect_count reported VERBATIM, so its stamp names Glottolog —
        # the earlier derived:* demand made 3,100 cards take credit for
        # Glottolog's count. `_fieldSources` values are lists post-atlas.
        src = fs.get("dialectCount", "")
        stamps = src if isinstance(src, list) else [src]
        ok = any(str(s).startswith(("glottolog", "derived:")) for s in stamps)
        emit(code, stratum, "dialectCount-provenance", "OK" if ok else "MISMATCH",
             src, "glottolog* (verbatim) or derived:*", "R6 carve-out")
    elif lrow and int(lrow.get("child_dialect_count") or 0) > 0:
        emit(code, stratum, "dialectCount", "GAP", None, lrow.get("child_dialect_count"), "upstream has dialects, card null")

    # 6. PHOIBLE block
    pi = card.get("phonologicalInventory")
    exp = phoible_expected(iso)
    if pi:
        if not exp:
            emit(code, stratum, "phoible-block", "MISMATCH", json.dumps(pi)[:120], "no PHOIBLE data for iso",
                 "card has inventory but PHOIBLE lacks language")
        else:
            diffs = []
            for k in ("consonants", "vowels", "tones", "totalPhonemes", "hasTone"):
                if k in pi and pi[k] != exp[k]:
                    diffs.append(f"{k}: card={pi[k]} recomputed={exp[k]}")
            if diffs:
                emit(code, stratum, "phoible-block", "MISMATCH", "; ".join(diffs),
                     f"perClass={exp['perClass']}", "atlas union rule (distinct segments per class)")
            else:
                emit(code, stratum, "phoible-block", "OK",
                     f"C{pi.get('consonants')}/V{pi.get('vowels')}/T{pi.get('tones')}",
                     f"C{exp['consonants']}/V{exp['vowels']}/T{exp['tones']}", "atlas union rule")
    elif exp:
        emit(code, stratum, "phoible-block", "GAP", None,
             f"C{exp['consonants']}/V{exp['vowels']}/T{exp['tones']}",
             "PHOIBLE has language, card lacks block")

    # 7. tone consistency (R1 independent) + WALS 13A faithfulness
    tp = card.get("typologicalProfile") or {}
    hts = tp.get("hasToneSystem")
    if pi and hts is not None and pi.get("hasTone") is not None:
        contradiction = (hts is True and pi["hasTone"] is False) or (hts is False and pi["hasTone"] is True)
        emit(code, stratum, "tone-R1-internal", "MISMATCH" if contradiction else "OK",
             f"hasToneSystem={hts}", f"phoible hasTone={pi['hasTone']}", "card-internal consistency")
    w13 = wals_feature(card, "13A")
    if hts is not None and w13:
        wals_tonal = any(n != "No tones" for n in w13)
        wals_atonal_only = w13 == {"No tones"}
        status = "OK"
        if hts is True and wals_atonal_only and not (pi and pi.get("hasTone")):
            status = "MISMATCH"
        if hts is False and wals_tonal and not (pi and pi.get("hasTone") is False):
            status = "WARN"  # generator rule 13A!=1 -> true; false with WALS tonal is odd unless PHOIBLE overrode
        emit(code, stratum, "tone-vs-wals13A", status, f"hasToneSystem={hts}", sorted(w13), "")
    tc = tp.get("toneComplexity")
    if tc and w13:
        expect = {"Complex tone system": "complex", "Simple tone system": "simple"}
        matches = [expect.get(n) for n in w13 if n in expect]
        if matches and tc not in matches:
            emit(code, stratum, "toneComplexity-vs-wals13A", "MISMATCH", tc, sorted(w13), "")

    # 8. speakerCount R2
    vit = card.get("vitality") or {}
    sc = vit.get("speakerCount")
    ests = card.get("speakerEstimates") or []
    if sc is not None:
        scs = vit.get("speakerCountSource")
        match = [e for e in ests if e.get("count") == sc]
        if scs == "champollion-derived":
            emit(code, stratum, "speakerCount-R2", "OK", f"{sc} src={scs}", "derived allowed",
                 vit.get("speakerCountNote", "")[:120] if vit.get("speakerCountNote") else "")
        elif match:
            src_ok = any(e.get("source") == scs for e in match)
            emit(code, stratum, "speakerCount-R2", "OK" if src_ok else "MISMATCH",
                 f"{sc} src={scs}", [f"{e['source']}:{e['count']}" for e in ests], "R2")
        else:
            emit(code, stratum, "speakerCount-R2", "MISMATCH", f"{sc} src={scs}",
                 [f"{e.get('source')}:{e.get('count')}" for e in ests], "no estimate equals displayed count")

    # 9. speakerEstimates vs upstream dumps
    for e in ests:
        s, cval = e.get("source"), e.get("count")
        if s == "wikidata":
            ups = wd_speakers.get(iso, set())
            if ups:
                emit(code, stratum, "speakerEst-wikidata", "OK" if cval in ups else "MISMATCH", cval, sorted(ups),
                     "wikidata-languages-full.json")
            else:
                emit(code, stratum, "speakerEst-wikidata", "NA", cval, None, "iso absent from local wikidata dump")
        elif s == "linguameta":
            lm = lm_by_iso.get(iso)
            up = (lm or {}).get("estimated_number_of_speakers", "")
            if up:
                try:
                    upn = int(float(up))
                    emit(code, stratum, "speakerEst-linguameta", "OK" if cval == upn else "MISMATCH", cval, upn, "linguameta.tsv")
                except ValueError:
                    emit(code, stratum, "speakerEst-linguameta", "NA", cval, up, "non-numeric upstream")
            else:
                emit(code, stratum, "speakerEst-linguameta", "NA", cval, None, "no linguameta speaker number")
        elif s == "elcat":
            ids = [r["ID"] for r in (elcat_by_iso.get(iso, []) or elcat_by_glotto.get(gc, []))]
            nums = set()
            for lid in ids:
                for p, v, _, _pf in elcat_values.get(lid, []):
                    if p in ("speakers", "speaker_number"):
                        for m in re.finditer(r"\d[\d,]*", str(v)):
                            try:
                                nums.add(int(m.group(0).replace(",", "")))
                            except ValueError:
                                pass
            if nums:
                emit(code, stratum, "speakerEst-elcat", "OK" if cval in nums else "MISMATCH", cval,
                     sorted(nums)[:8], "elcat values")
            else:
                emit(code, stratum, "speakerEst-elcat", "NA", cval, None, "no elcat numbers")

    # 10. endangerment envelope per-source verbatim + spread completeness,
    # against the atlas SSOT (cldf_values rows whose parameter projects into
    # the `endangerment` card field), plus upstream-truth checks of the atlas
    # rows themselves against the ELCat / AES / LinguaMeta dumps — the latter
    # catch ingest corruption independently of the projection.
    lm = lm_by_iso.get(iso)
    lm_status = (lm or {}).get("endangerment_status", "").strip()
    aes = aes_by_glotto.get(gc) if gc else None
    atlas_end = atlas_facts(iso, "endangerment")

    # The projection may wrap endangerment in an attribution envelope; read the
    # PRISTINE card (normalize_card mutated `card` in place above).
    raw_end = json.load(open(card_path)).get("endangerment")
    card_end = [(str(e.get("value", "")), str(e.get("source", "")))
                for e in attributions(raw_end) if isinstance(e, dict)]

    # upstream-truth checks: each atlas row vs its own source's dump
    pref_lei = elcat_preferred_lei(iso, gc)
    for val, src, _comment, _derived in atlas_end:
        if src.startswith("elcat"):
            ids = [r["ID"] for r in (elcat_by_iso.get(iso, []) or (elcat_by_glotto.get(gc, []) if gc else []))]
            # The atlas ingest strips ELCat's certainty parenthetical into
            # Comment; strip it from the upstream values before comparing.
            ups = {re.sub(r"\s*\(.*\)\s*$", "", str(v)).strip().lower() for lid in ids
                   for p, v, _, _pf in elcat_values.get(lid, []) if p in ("LEI", "vitality")}
            ups.discard("")
            if ups:
                emit(code, stratum, "endangerment-atlas-vs-elcat",
                     "OK" if str(val).strip().lower() in ups else "MISMATCH",
                     val, sorted(ups)[:8],
                     f"atlas {src} vs elcat values.csv" + (f" (preferred: {pref_lei})" if pref_lei else ""))
            else:
                emit(code, stratum, "endangerment-atlas-vs-elcat", "NA", val, None,
                     "no elcat LEI/vitality rows in dump")
        elif src.startswith("glottolog"):
            if aes:
                up_label = AES_LABELS.get(int(aes["Value"]), "?")
                emit(code, stratum, "endangerment-atlas-vs-aes",
                     "OK" if str(val).strip().lower() == up_label else "MISMATCH",
                     val, up_label, "atlas glottolog row vs aes-values.csv")
            else:
                emit(code, stratum, "endangerment-atlas-vs-aes", "NA", val, None,
                     "no AES row in dump")
        elif src.startswith("linguameta"):
            if lm_status:
                emit(code, stratum, "endangerment-atlas-vs-linguameta",
                     "OK" if str(val).strip().lower() == lm_status.lower() else "MISMATCH",
                     val, lm_status, "atlas linguameta row vs linguameta.tsv")
            else:
                emit(code, stratum, "endangerment-atlas-vs-linguameta", "NA", val, None,
                     "no linguameta endangerment_status in dump")

    # projection fidelity: card envelope entries ↔ atlas rows, both directions
    atlas_pairs = {(str(v), str(s)) for v, s, _c, _d in atlas_end}
    if card_end or atlas_pairs:
        extra = [p for p in card_end if p not in atlas_pairs]
        emit(code, stratum, "endangerment-card-vs-atlas", "OK" if not extra else "MISMATCH",
             sorted(card_end), sorted(atlas_pairs),
             f"card entries absent from atlas: {extra}" if extra
             else "every card endangerment entry is an atlas row")
        missing = [p for p in atlas_pairs if p not in card_end]
        if card_end:
            emit(code, stratum, "endangerment-spread", "OK" if not missing else "MISMATCH",
                 sorted({s for _v, s in card_end}), sorted({s for _v, s in atlas_pairs}),
                 f"atlas rows missing from card: {missing}" if missing
                 else "all atlas-visible endangerment claims represented")
        elif atlas_pairs:
            emit(code, stratum, "endangerment-spread", "GAP", None, sorted(atlas_pairs),
                 "atlas has endangerment rows, card lacks the field")

    # 11. script + scriptUnicodeName (R6)
    script = card.get("script")
    sun = card.get("scriptUnicodeName")
    if script:
        lm_scripts = ((lm or {}).get("writing_systems") or "").replace(";", ",").split(",")
        lm_scripts = [s.strip() for s in lm_scripts if s.strip()]
        if lm_scripts:
            emit(code, stratum, "script-vs-linguameta", "OK" if script in lm_scripts else "WARN",
                 script, lm_scripts, f"fs={fs.get('script')}")
        if sun:
            expect = script_map.get(script)
            emit(code, stratum, "scriptUnicodeName", "OK" if sun == expect else "MISMATCH",
                 sun, expect, f"generator map for {script}")
            src = fs.get("scriptUnicodeName", "")
            emit(code, stratum, "scriptUnicodeName-provenance", "OK" if str(src).startswith("derived:") else "MISMATCH",
                 src, "derived:*", "R6")

    # 12. wordOrderDominant vs WALS 81A
    wod = tp.get("wordOrderDominant")
    w81 = wals_feature(card, "81A")
    if wod is not None or w81:
        if w81:
            expected = {WORD_ORDER_81A.get(n, n) for n in w81}
            if wod is None:
                emit(code, stratum, "wordOrder-81A", "GAP", None, sorted(expected), "WALS has 81A, card null")
            else:
                emit(code, stratum, "wordOrder-81A", "OK" if wod in expected else "MISMATCH",
                     wod, sorted(expected), "WALS 81A decoded")
        elif wod is not None:
            gb = grambank_vals.get(gc, {}) if gc else {}
            emit(code, stratum, "wordOrder-no-81A", "WARN", wod, f"grambank {gb}" if gb else "no 81A/grambank",
                 "no WALS 81A: dominance claim needs non-WALS dominance source (APiCS etc.)")

    # 13. R3 independent scan: metric-like measured values on card.
    # pipelineReadiness.score is a derived CAPABILITY composite (allowed per
    # the boundary rule: pipelineReadiness.source='derived' is CORRECT) — not
    # a measured method-output score. Exclude it, scan everything else.
    # RAW parse on purpose: R3 must scan the pristine on-disk JSON, never the
    # adapter's normalized view (which mutated `card` in place above).
    card_scan = json.load(open(card_path))
    card_scan.pop("pipelineReadiness", None)
    raw = json.dumps(card_scan)
    r3_hits = []
    for pat in (r'"(chrf|chrF|bleu|BLEU|comet|COMET|ter|TER|spBLEU)[^"]*"\s*:\s*[\d.]+',
                r'"(score|accuracy|f1|precision|recall)"\s*:\s*[\d.]+'):
        for m in re.finditer(pat, raw):
            r3_hits.append(m.group(0)[:60])
    emit(code, stratum, "R3-run-results", "MISMATCH" if r3_hits else "OK",
         r3_hits if r3_hits else "none", "no measured method-output scores allowed", "")

    # 14. name + isoType vs ISO 639-3 tab
    it = iso3.get(iso)
    if it:
        if card.get("isoType") and card["isoType"] != it["Language_Type"]:
            emit(code, stratum, "isoType", "MISMATCH", card["isoType"], it["Language_Type"], "iso-639-3.tab")
        nm = card.get("name")
        if nm and nm != it["Ref_Name"]:
            emit(code, stratum, "name-vs-iso", "WARN", nm, it["Ref_Name"], "differs from ISO Ref_Name (may be deliberate)")

# ── Output ──────────────────────────────────────────────────────────────────
out_tsv = _args.tsv
if out_tsv:
  with open(out_tsv, "w") as f:
      w = csv.DictWriter(f, fieldnames=["code", "stratum", "check", "status", "card", "upstream", "evidence"], delimiter="\t")
      w.writeheader()
      for r in results:
          w.writerow(r)

summary = defaultdict(lambda: defaultdict(int))
for r in results:
    summary[r["check"]][r["status"]] += 1
n_mm = sum(1 for r in results if r["status"] == "MISMATCH")
STATUSES = ("OK", "MISMATCH", "WARN", "GAP", "NA")

if _args.json:
    # `completed` is emitted only here, at the very end of a full pass — so a
    # run that died partway through produces no payload at all and is scored
    # UNVERIFIABLE by scripts/audit_runner.py, never as a clean run.
    json.dump({
        "schema": 1,
        "completed": True,
        "sample": {"profile": "frozen-62" if not _args.sample else _args.sample,
                   "cards": len({r["code"] for r in results}),
                   "note": "NOT the full corpus — a frozen stratified sample. "
                           "A clean result here is not a corpus-wide verdict."},
        "totals": {"rows": len(results),
                   **{s: sum(1 for r in results if r["status"] == s) for s in STATUSES}},
        "byCheck": {c: {s: summary[c][s] for s in STATUSES} for c in sorted(summary)},
        "results": results,
    }, sys.stdout, indent=1, default=str)
    sys.stdout.write("\n")
else:
    print(f"{'check':32s} {'OK':>5} {'MISM':>5} {'WARN':>5} {'GAP':>5} {'NA':>5}")
    for chk in sorted(summary):
        s = summary[chk]
        print(f"{chk:32s} {s['OK']:>5} {s['MISMATCH']:>5} {s['WARN']:>5} {s['GAP']:>5} {s['NA']:>5}")
    print(f"\ntotal rows: {len(results)}  MISMATCH: {n_mm}")
    if out_tsv:
        print("wrote", out_tsv)
    if n_mm:
        print("\n== MISMATCHES ==")
        for r in results:
            if r["status"] == "MISMATCH":
                print(f"[{r['stratum']}/{r['code']}] {r['check']}: card={r['card']} upstream={r['upstream']} {r['evidence']}")

# EXIT CONTRACT (new 2026-08-01). This script previously had NO sys.exit call
# at all, so it ALWAYS exited 0 — and scripts/steward_report.py reduced its
# verdict to a grep of stdout for the literal "MISMATCH: 0". A reformatted
# summary line, or a crash after the table printed, read as a pass. It has
# been reporting MISMATCH: 2 while every gate stayed green.
#   0 = no mismatches   1 = mismatches found   2 = could not run
sys.exit(1 if n_mm else 0)
