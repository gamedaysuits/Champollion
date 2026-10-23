import React from 'react';
import {translate} from '@docusaurus/Translate';
import {FullStorySeam} from './home-preview';

/* ====================================================================
   /vision — THE LONG VISION. The network scroll that was the homepage until
   the 2026-10 rails rewrite (founder, 2026-10-08: "the network animation
   moves to a long-vision page"). It is the one page where "every language,
   into every language" may appear, and only as an aim; the scroll
   illustrates the mechanism and is not a record of measurements (its
   standing footer says so in the frame). /home-preview redirects here.
   ==================================================================== */
export default function Vision() {
  return (
    <FullStorySeam
      indexable
      seoTitle={translate({id: 'rails.vision.seo.title', message: 'The long vision'})}
      seoDescription={translate({id: 'rails.vision.seo.description', message: 'The long vision behind Champollion: methods that communities have measured, connected pair by pair, on terms each community sets. An aim, illustrated — not a record of measurements.'})}
    />
  );
}
