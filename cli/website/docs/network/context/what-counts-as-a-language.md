---
sidebar_position: 2
title: 'What Counts as a Language Here?'
---

# What Counts as a Language Here?

> **Executive Summary.** The Network catalogs languages by ISO 639-3, benchmarks individual languages (not macrolanguage umbrellas), includes sign languages as the natural languages they are, includes ISO-recognized constructed languages, excludes programming languages, and displays taxonomy disputes without taking sides. This page explains each choice and what it means for the leaderboard.

Any project that benchmarks translation across thousands of languages has to answer an old and surprisingly hard question: what counts as a language? Linguists have known for a long time that the boundary between "language" and "dialect" is as much social and political as it is structural — the famous quip that *"a language is a dialect with an army and navy"* was popularized by the Yiddish linguist Max Weinreich in 1945 (he credited it to an audience member at one of his lectures). We can't dodge the question, so here are our answers, and our reasoning.

---

## Sign languages are languages. Full stop.

Sign languages are natural languages — with complete grammars, native acquisition by children, and living language communities. This has been settled linguistics since William Stokoe's 1960 demonstration that American Sign Language has the same kind of internal structure as spoken languages, and sixty years of research since (Klima & Bellugi 1979; Sandler & Lillo-Martin 2006) has only deepened the point. ISO 639-3 assigns sign languages individual language codes; Glottolog catalogs them alongside spoken families. Our catalog includes more than 160 of them, tagged `modality: signed`.

Some are endangered Indigenous languages: Plains Indian Sign Language (`psd`), historically a major intertribal lingua franca across North America, is critically endangered today (Davis 2010, *Hand Talk*). Sign-language endangerment *is* Indigenous-language endangerment, and it is inside this project's mission.

**An honest scope note.** The Network currently benchmarks *text-based* machine translation. Signed-language MT — working with video, spatial grammar, and languages that have no widely adopted written form — is a different and largely unsolved technical problem (see Yin et al. 2021, "Including Signed Languages in Natural Language Processing," ACL). We do not yet serve it. Sign-language entries in our catalog say exactly that: **not yet served — never "not a language."**

## There are two modalities. Writing isn't one of them.

Languages come in two primary modalities: **spoken** and **signed**. Writing is not a third modality — it's a technology layered on top of a language, and most of the world's languages get along without a standardized one. That's why our language cards track writing separately (which scripts a language uses, or whether it has no standardized orthography at all) and track it honestly: for a text-based MT platform, whether a language is written is critical information, not a footnote — and an unwritten language is not a lesser language.

## Constructed languages: in. Programming languages: out.

We follow ISO 639-3's own line. The standard admits a constructed language only if it is a complete language, designed for human communication, with a literature and a community that has passed it to a second generation of users — and it explicitly excludes computer programming languages. Esperanto, with its native speakers, qualifies; Python does not, because nobody acquires Python as a first language from their parents. Our catalog includes the two dozen constructed languages ISO recognizes, typed as such, and no programming languages.

## We benchmark individual languages, not umbrellas

ISO 639-3 distinguishes *individual languages* from *macrolanguages* — umbrella codes like `cre` (Cree), `ara` (Arabic), or `zho` (Chinese) that cover several closely related individual languages. The Network's benchmark unit is the **individual language**, for an operational reason: translation resources are variety-specific. A morphological analyzer built for Plains Cree (`crk`) does not generate Moose Cree (`crm`); a corpus of Egyptian Arabic says little about a method's quality in Moroccan Arabic. A score attached to an umbrella code would be a claim about varieties that were never actually evaluated — so we don't do it.

Macrolanguages still appear in the catalog as **hub pages**: navigation that links an umbrella identity to its individual members, reflecting ISO's own observation that both levels of identity are real. Below the individual language, we display dialect and lineage information from Glottolog's languoid tree (Hammarström & Forkel 2022), which models families, languages, and dialects as one navigable hierarchy.

**What about corpora that arrive labeled with an umbrella code?** A lot of real-world data does — datasets published as "Quechua," "Persian," or "Chinese (Simplified)." We treat the upstream label as *metadata to resolve*, not a truth to obey or discard. Mechanical cases resolve automatically from the official ISO tables: a script tag is stripped (`cmn-Hans` is Mandarin Chinese, written in Simplified Han — the script is recorded, the language identity is `cmn`), and a retired code follows its official successor. When the publisher documents which variety their data actually is — FLORES+ codes its Quechua record `quy`, Ayacucho Quechua — we record that resolution *with the citation* on the corpus's registry entry, and the corpus is benchmarked under the real individual language. And when nobody can say which variety a collection contains (some community sentence collections keep a deliberately generic "Arabic" bucket), we do not guess: the corpus stays catalogued under its own label, it is excluded from the work queue with a machine-readable reason you can see in the queue's metadata, and any historical scores on it stay attached to an honestly-labeled umbrella node — never silently credited to a variety that was never evaluated. Every resolution is re-derivable: the pinned ISO tables, the per-corpus resolution stamps, and the citations all ship in the public registry.

## When the authorities disagree, we show both

ISO 639-3 and Glottolog occasionally split or lump differently, and communities sometimes disagree with both. We don't adjudicate. Language cards carry a *taxonomy notes* affordance that displays the disagreement with sources, and naming follows the community wherever the community has expressed a preference. Whether a variety is "a language" is, in the end, partly a question of identity — and identity questions belong to the communities themselves, a principle we adopt from Indigenous data-governance frameworks.

## A research direction: benchmarks as a measuring instrument

One thing an arena like this produces, almost as a by-product, is a new kind of evidence about how close language varieties really are *operationally*. If a single translation method, held fixed, serves several related varieties at deployable quality, those varieties cluster in practice; if they demand separate corpora and separate methods, they are operationally distinct — whatever the naming politics say. This resembles older empirical traditions, from recorded-text intelligibility testing to automated lexical-distance measures, with a deployment-grounded twist.

We offer this carefully, as a research direction rather than a claim. Method-transfer results are confounded by corpus size, domain, orthography, and training-data contamination, and a clustering is always relative to a method and a quality threshold. Above all: this signal can *inform* conversations about language and dialect, but it never overrides how a community identifies its own language.

---

## References

- Davis, Jeffrey E. (2010). *Hand Talk: Sign Language among American Indian Nations.* Cambridge University Press.
- Dryer, Matthew S. & Martin Haspelmath, eds. (2013). *The World Atlas of Language Structures Online.* https://wals.info
- Hammarström, Harald & Robert Forkel (2022). "Glottocodes: Identifiers Linking Families, Languages and Dialects to Comprehensive Reference Information." *Semantic Web* 13(6).
- Haugen, Einar (1966). "Dialect, Language, Nation." *American Anthropologist* 68(4).
- ISO 639-3 Registration Authority. "Scope of denotation" and "Types of individual languages." https://iso639-3.sil.org/about/scope · https://iso639-3.sil.org/about/types
- Klima, Edward S. & Ursula Bellugi (1979). *The Signs of Language.* Harvard University Press.
- Sandler, Wendy & Diane Lillo-Martin (2006). *Sign Language and Linguistic Universals.* Cambridge University Press.
- Stokoe, William C. (1960). *Sign Language Structure.* Studies in Linguistics, Occasional Papers 8.
- Weinreich, Max (1945). "Der YIVO un di problemen fun undzer tsayt." *YIVO Bleter* 25(1).
- Yin, Kayo, Amit Moryossef, Julie Hochgesang, Yoav Goldberg & Malihe Alikhani (2021). "Including Signed Languages in Natural Language Processing." *Proc. ACL-IJCNLP 2021.* https://aclanthology.org/2021.acl-long.570/


## Where this leads on this site

The counting rules here govern every number on this site: the
[coverage methodology](/docs/network/context/coverage-counting) applies
them to MT services, and the
[language cards](/docs/reference/language-card-spec) record, per language,
what every source actually claims.
