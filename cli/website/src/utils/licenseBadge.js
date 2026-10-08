/**
 * licenseBadge — pure, browser-safe license-restriction helpers for the
 * leaderboard / mesh / card UIs.
 *
 * This is the front-end mirror of the NC detection in cli/lib/license-gate.mjs
 * (`isNonCommercialSpdx`). It is intentionally dependency-free (no `fs`) so it
 * can be bundled into the Docusaurus client. Its one job is BADGING — surfacing
 * a dataset's NonCommercial / research-only status prominently — not gating.
 *
 * Project doctrine: an NC dataset is usable for non-commercial /
 * research evaluation but NOT for commercial / API use. The leaderboard must
 * make that license visible on every NC dataset, so a viewer (or an agent
 * scraping the board) can see the restriction at a glance.
 */

/** Does this SPDX/license string carry a NonCommercial restriction? */
export function isNonCommercialLicense(license) {
  if (!license) return false;
  const s = String(license).toUpperCase();
  return s.includes("-NC") || s.includes("NONCOMMERCIAL") || s.includes("NON-COMMERCIAL");
}

/** Does this license carry a ShareAlike / copyleft obligation? */
export function isShareAlikeLicense(license) {
  if (!license) return false;
  const s = String(license).toUpperCase();
  return s.includes("-SA") || s.includes("SHAREALIKE") || s.includes("GPL");
}

/** Does this license carry a NoDerivatives restriction? */
export function isNoDerivativesLicense(license) {
  if (!license) return false;
  const s = String(license).toUpperCase();
  return s.includes("-ND") || s.includes("NODERIV");
}

/**
 * Restriction badges to render for a license string.
 * Returns an array of { code, label, title } — empty for permissive licenses.
 * `code` drives styling ("nc" is the prominent research-only badge).
 */
export function licenseBadges(license) {
  const badges = [];
  if (isNonCommercialLicense(license)) {
    badges.push({
      code: "nc",
      label: "Non-commercial / research-only",
      title:
        "NonCommercial license — usable for non-commercial / research " +
        "evaluation, but NOT for commercial or API use, and the corpus " +
        "content may not be redistributed.",
    });
  }
  if (isShareAlikeLicense(license)) {
    badges.push({
      code: "sa",
      label: "ShareAlike",
      title: "ShareAlike — derivatives must keep the same license.",
    });
  }
  if (isNoDerivativesLicense(license)) {
    badges.push({
      code: "nd",
      label: "NoDerivatives",
      title: "NoDerivatives — the content may not be remixed or redistributed.",
    });
  }
  return badges;
}
