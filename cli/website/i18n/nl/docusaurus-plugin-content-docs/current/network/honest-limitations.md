---
title: "Eerlijke Beperkingen"
description: "Wat Champollion (nog) niet claimt. De controleerbare grenzen van onze evaluatie, vertrouwensniveaus, communityvalidatie en gereserveerde infrastructuur."
---

# Eerlijke Beperkingen

> Dit zijn de claims die wij **niet** zullen overschrijden. Als iets elders op
> deze site meer impliceert dan wat hier staat, beschouw dat dan als een fout en
> [meld het ons](/docs/network/perspectives/reporting-errors-and-owning-corrections).

Evaluatie-infrastructuur verdient vertrouwen alleen door eerlijk te zijn over haar grenzen. Hier zijn de onze, duidelijk genoeg geformuleerd om te controleren.

## 1. Diepgaande morfologische validatie dekt momenteel slechts één taalpaar

FST-gebaseerde morfologische validatie — het controleren of elk uitvoerwoord een correct gevormd woord is in de doeltaal — is in de praktijk uitsluitend ingericht voor **Engels → Plains Cree**. Het `GiellaLTFSTMetric` zelf is **generiek**: het beoordeelt elke taal met een gepubliceerde GiellaLT `.hfstol`-analysator (Plains Cree, de Sámi-talen, Fins, Noors Bokmål, Inuktitut en andere), zodat de mogelijkheid breed is. Maar **evaluatiecorpora bestaan vandaag alleen voor Plains Cree**, waardoor crk het enige taalpaar is dat in de praktijk FST-gescoord wordt. Elk ander taalpaar op het scorebord wordt beoordeeld met oppervlaktemetrieken (chrF++, BLEU) en gedragscontroles. Dit zijn nuttige signalen, maar zij **garanderen geen morfologische geldigheid**. Wij claimen geen morfologische validatie voor enige taal zonder zowel een FST als een evaluatiecorpus.

## 2. Vertrouwensniveaus zijn bij lancering zelfgerapporteerd

De meeste scores worden berekend door bijdragers die de harness zelf uitvoeren en het resultaat publiceren. Server-side **verificatie** — het opnieuw scoren van een inzending aan de hand van het SHA-vastgezette canonieke corpus — bestaat en wordt uitgebreid, maar "geverifieerd" is nog niet universeel. Lees het vertrouwenskeurmerk op elke rij: **"zelfgerapporteerd" betekent precies dat**, en het is de standaard.

## 3. Gemeenschapsvalidatie door sprekers heeft nog niet plaatsgevonden

Onze prijs vereist **≥ 70% acceptatie van tweetalige sprekers**. Die drempel is gespecificeerd en de tooling om deze uit te voeren is in ontwikkeling — maar **er is geen gemeenschapsreview door sprekers uitgevoerd**, en **geen enkele score op deze site heeft de sprekerdrempel gehaald**. Samengestelde scores en chrF++-cijfers zijn machinesignalen, geen oordeel van de gemeenschap.

## 4. De evaluatiesandbox bestaat; de bewaarceremonie nog niet

Wij halen corpora op van hun bron en voorzien deze van een SHA-pin, en achtergehouden splitsingen worden verzegeld. Wanneer een gemeenschap een geheime testset bezit, kan een methode hiertegen worden gescoord zonder dat de set ooit hun handen verlaat — en die evaluatie heeft nu **twee sporen**. Het voorkeursspoor, voor standaard neurale modellen, is **declaratief**: de deelnemer dient uitsluitend gegevens in — safetensors-gewichten + een declaratieve tokenizer + een configuratie — en de organisator draait deze in zijn eigen vertrouwde inference engine (`trust_remote_code=False`, offline; tolerant wat betreft de architectuur omdat de veiligheid in het codevrije formaat zit, niet in de naam van de architectuur). Er wordt helemaal geen code van de deelnemer uitgevoerd, dus er is niets om in een sandbox te plaatsen; de veiligheidscontrole is een beslisbare formaatvalidatie (is dit safetensors en geen pickle? geen `trust_remote_code`?), en geen poging om te bewijzen dat willekeurige code veilig is. Voor methoden die daadwerkelijk uit code bestaan (pipelines, LLM-gecoachte hybriden), is de terugvaloptie de netwerkgeïsoleerde **sandbox** (statische controles, `--network=none`-containers, uitgaand verkeer uitsluitend voor scores, een optioneel true-airgap bestandstransport). De sandbox perkt onvertrouwde code in in plaats van te weigeren deze uit te voeren, dus het is eerlijk gezegd het zwakkere spoor — de dragende garantie is `--network=none` (een heuristische statische scan kan een binair model niet doorlichten), en diepere verharding (seccomp, microVMs) wordt uitgesteld. Zie [een soevereine wedstrijd organiseren](/docs/network/sovereignty/run-a-sovereign-contest) voor wat er precies live is en wat niet. Wat in beide gevallen **niet** is gebouwd: de kant van het sleutelbeheer door de gemeenschap — drempelondertekening, sleutelceremonies en node-attestatie. De autorisatie van vandaag is een vastgelegd proces (enkele beheerders, enkele sleutels, eerlijk gelabeld), dus de gouden standaard voor **prijs**-evaluatie blijft gesloten totdat het beheerwerk en de toestemming van de gemeenschap een inhaalslag hebben gemaakt.

## 5. Sleutelbeheer is besloten; gemeenschapsbeheerders zijn in bevestiging

Het bewaar*mechanisme* is besloten: een drempel-/multisig-schema waarbij **Champollion nul sleutelaandelen bezit**. De beheerders zelf worden gekozen door de gemeenschappen, en die gesprekken zijn gaande — daarom spreken wij van **"gemeenschapssleutelbeheerders (in bevestiging)."** Bewaarneming is geen toestemming: het relationele proces van instemming door de gemeenschap is een eigen, langzamer en belangrijker traject.

---

Deze beperkingen zullen verschuiven naarmate het werk vordert. Wanneer een van deze beperkingen verandert, verandert deze pagina mee — en de wijziging dient zichtbaar te zijn in de paginageschiedenis, niet stilzwijgend verwijderd.
