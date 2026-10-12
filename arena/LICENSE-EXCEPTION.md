# Champollion MT-Eval Harness — Eval-Standard Plugin Exception

Copyright 2026 Curtis Forbes / Champollion.

The Champollion MT-Eval Harness ("the Harness") is licensed under the GNU Affero
General Public License, version 3 or (at your option) any later version
(AGPL-3.0-or-later). The full text is in the `LICENSE` file. The following is an
**additional permission** under section 7 of the AGPL-3.0.

## Additional permission under AGPL-3.0 §7 (Eval-Standard Plugins)

As a special exception, the copyright holder gives you permission to **combine the
Harness with one or more "Eval-Standard Plugins"** and to convey the resulting
combined work.

An **"Eval-Standard Plugin"** is a separately developed package that supplies
language-specific evaluation metrics to the Harness, and that interoperates with
the Harness only through its **public plugin interface**, namely:

  - the `champollion.eval_standards` entry-point group;
  - the `MetricPlugin` protocol (`compute` / `aggregate`) the Harness defines for
    metric plugins;
  - the language-card `evalStandard` / `evalMetrics` discovery-and-load mechanism
    (`mt_eval_harness.plugin_discovery`, `mt_eval_harness.language_cards`); and
  - the documented helper functions the Harness exposes for plugins to call —
    including the FST installer helpers `is_fst_installed`, `get_fst_cache_dir`,
    and `find_analyzer_hfstol` in `mt_eval_harness.plugins.fst_installer`.

You may convey such a combination, and you may license each Eval-Standard Plugin
under **terms of your own choosing**, including terms that are not compatible with
the AGPL — for example, source-available **noncommercial** licenses such as the
PolyForm Noncommercial License — provided that:

  1. you continue to comply with the AGPL-3.0 for the Harness itself (including its
     source-availability and §13 network-use obligations) and for any modifications
     you make to the Harness; and

  2. each Eval-Standard Plugin interoperates with the Harness solely through the
     public plugin interface described above, and is not otherwise derived from the
     Harness's source code (it may import and call that public interface; merely
     doing so does not make the Plugin a work based on the Harness for the purposes
     of this permission).

This permission applies only to the combination of the Harness with Eval-Standard
Plugins across that plugin interface. It grants no other rights, and it does not
change the license of the Harness, which remains AGPL-3.0-or-later. In particular,
it does not permit conveying a modified Harness under any terms other than the AGPL.

As provided in AGPL-3.0 §7, a recipient of the Harness may remove this additional
permission from their copy. Removing it does not affect Eval-Standard Plugins
conveyed by others.

This text is a license grant by the copyright holder; it is not legal advice.
