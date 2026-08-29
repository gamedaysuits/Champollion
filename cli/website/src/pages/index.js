import React from 'react';
import {FullStorySeam} from './home-preview';

/* ====================================================================
   Homepage (/) — THE FULL STORY SEAM.

   Founder go-live 2026-07-24: the homepage IS the full-story scroll —
   one pinned scroll on the real hero map that walks the whole argument
   (the coverage gap → measurement → the mapped network → the living,
   condensing route → the sovereign seal → the support-structure CTAs).
   It replaces the earlier v4 hero + funnel + proof composition.

   The seam lives in ./home-preview (FullStorySeam). Here it renders with
   `indexable` + the mission SEO; at /home-preview the same component
   renders as an unlinked, noindex preview (that URL now 307-redirects to
   / via vercel.json). Reduced-motion visitors get the static article
   fallback built into FullStorySeam.

   NOTE (i18n): the seam narrative is authored in English; localized
   homepages render the same English scroll until the captions are wrapped
   for translation. This is the founder-approved launch state.
   ==================================================================== */

export default function Home() {
  return (
    <FullStorySeam
      indexable
      seoTitle="Every language, into every language"
      seoDescription="Open machine translation infrastructure for at-risk, endangered, and underserved languages — measured pair by pair, with communities holding the keys."
    />
  );
}
