import React, {useId} from 'react';

/**
 * BrandMark — the Champollion "rosetta stela" mark, inline.
 *
 * A heavy stone slab with a jagged broken top-right corner carrying
 * three registers of incised script, echoing the Rosetta Stone's three
 * scripts. Tapered sides + flat base keep the silhouette reading as
 * stone (not a paper document) even at 24px. The registers use the
 * vitality triad tokens (teal / amber / coral), so the mark recolors
 * with the theme automatically; the stone recolors via --brand-stone
 * (ink in light mode, granite grey in dark mode — wave 3 retired the
 * white "paper squeeze"), and the dark theme adds a lit top-left edge
 * (--brand-stone-edge) plus a brighter fracture facet on the broken
 * corner (--brand-stone-break) so the slab reads as carved stone on
 * ink backgrounds. Both edge tokens are transparent in light mode.
 * See src/css/custom.css and DESIGN.md §1.
 *
 * Static-file siblings (navbar/favicon/social card) live in
 * static/img/{logo.svg, logo-dark.svg, favicon.svg}.
 */
export default function BrandMark({size = 32, title = 'Champollion', ...rest}) {
  // Unique clipPath id — the mark appears more than once per page
  // (hero + footer) and SVG ids are document-global.
  const clipId = useId();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      {...rest}
    >
      <clipPath id={clipId}>
        <path d="M5 29.5 L6.6 4.2 L18.2 3 L20.6 6.4 L24.6 4.9 L27.4 9.6 L26.6 29.5 Z" />
      </clipPath>
      <path
        d="M5 29.5 L6.6 4.2 L18.2 3 L20.6 6.4 L24.6 4.9 L27.4 9.6 L26.6 29.5 Z"
        fill="var(--brand-stone, #1F2421)"
      />
      <g
        clipPath={`url(#${clipId})`}
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M5 29.5 L6.6 4.2 L18.2 3"
          stroke="var(--brand-stone-edge, transparent)"
        />
        <path
          d="M18.2 3 L20.6 6.4 L24.6 4.9 L27.4 9.6"
          stroke="var(--brand-stone-break, transparent)"
        />
      </g>
      <g strokeWidth="2.6" strokeLinecap="round" fill="none">
        <g stroke="var(--brand-register-1, #3FC1C0)">
          <path d="M9.6 12.6h5.2" />
          <path d="M17.6 12.6h5.6" />
        </g>
        <g stroke="var(--brand-register-2, #E8B339)">
          <path d="M9.5 17.6h2.6" />
          <path d="M15 17.6h5" />
          <path d="M22.8 17.6h0.8" />
        </g>
        <g stroke="var(--brand-register-3, #F08A93)">
          <path d="M9.4 22.6h7" />
          <path d="M19.4 22.6h3.8" />
        </g>
      </g>
    </svg>
  );
}
