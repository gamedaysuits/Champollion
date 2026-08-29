/**
 * RegionMap — SVG world map with highlighted province/state boundaries.
 *
 * Uses react-simple-maps to render a base world map, then overlays
 * province-level boundaries from Natural Earth admin-1 data. Regions
 * are highlighted using ISO 3166-2 codes from the card's admin1Codes.
 *
 * WHY PROVINCE BOUNDARIES INSTEAD OF DOTS:
 *   A dot in Saskatchewan doesn't represent where Plains Cree is spoken.
 *   Highlighting the actual provincial boundaries of SK, AB, and MB does.
 *   This is fact-based — the boundaries come from ISO 3166-2 and Natural Earth.
 *
 * For cards without admin1Codes, falls back to whole-country highlighting.
 * For cards where admin1Codes is null (language spoken nationwide),
 * the entire country is highlighted.
 */

import React, { useMemo } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import styles from './RegionMap.module.css';

// Country-level base map (110m resolution, ~110KB via CDN)
const COUNTRIES_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Province-level boundaries (Natural Earth admin-1, hosted locally)
const PROVINCES_URL = '/data/world-provinces.topo.json';

/**
 * Collect all admin1Codes and countryCode values from regions.
 * Returns { admin1Set: Set<string>, countrySet: Set<string>, hasAdmin1: boolean }
 */
function collectHighlightCodes(regions) {
  const admin1Set = new Set();
  const countrySet = new Set();
  let hasAdmin1 = false;

  for (const r of regions) {
    if (r.countryCode) countrySet.add(r.countryCode);

    if (r.admin1Codes && Array.isArray(r.admin1Codes)) {
      // Specific provinces listed — highlight just those
      r.admin1Codes.forEach((code) => admin1Set.add(code));
      hasAdmin1 = true;
    } else if (r.admin1Codes === null && r.countryCode) {
      // admin1Codes explicitly null → entire country is a speaking area
      // We'll handle this by matching all provinces with this country code
    }
  }

  return { admin1Set, countrySet, hasAdmin1 };
}

/**
 * Check if a province should be highlighted.
 * Province feature properties: { i: iso_3166_2, c: iso_a2, n: name }
 */
function shouldHighlightProvince(feature, regions) {
  const iso = feature.properties.i;      // e.g., "CA-SK"
  const cc = feature.properties.c;       // e.g., "CA"

  for (const r of regions) {
    if (r.countryCode !== cc) continue;

    if (r.admin1Codes && Array.isArray(r.admin1Codes)) {
      // Specific provinces listed — check for match
      if (r.admin1Codes.includes(iso)) return true;
    } else if (r.admin1Codes === null) {
      // null means "whole country" — highlight all provinces in this country
      return true;
    }
  }
  return false;
}

/**
 * Compute center and zoom to fit highlighted regions.
 * Uses coordinates from the regions data as guide points.
 */
function computeProjection(regions) {
  const coords = regions
    .filter((r) => r.coordinates && r.coordinates.length === 2)
    .map((r) => r.coordinates);

  if (coords.length === 0) {
    return { center: [0, 20], zoom: 1 };
  }

  if (coords.length === 1) {
    return { center: coords[0], zoom: 3.5 };
  }

  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const maxSpread = Math.max(
    Math.max(...lngs) - Math.min(...lngs),
    Math.max(...lats) - Math.min(...lats)
  );

  let zoom;
  if (maxSpread > 120) zoom = 1;
  else if (maxSpread > 60) zoom = 1.5;
  else if (maxSpread > 30) zoom = 2.5;
  else if (maxSpread > 15) zoom = 3.5;
  else if (maxSpread > 5) zoom = 5;
  else zoom = 6;

  return { center: [centerLng, centerLat], zoom };
}

/**
 * The actual map component — rendered only in the browser.
 */
function RegionMapInner({ regions, accentColor }) {
  const {
    ComposableMap,
    Geographies,
    Geography,
    ZoomableGroup,
  } = require('react-simple-maps');

  const projection = useMemo(() => computeProjection(regions), [regions]);
  const accent = accentColor || '#3FC1C0';

  // Collect which country codes are relevant (to skip irrelevant provinces)
  const { countrySet } = useMemo(
    () => collectHighlightCodes(regions),
    [regions]
  );

  return (
    <div className={styles.mapContainer}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 150 }}
        width={400}
        height={260}
        style={{ width: '100%', height: 'auto' }}
      >
        <ZoomableGroup
          center={projection.center}
          zoom={projection.zoom}
          minZoom={1}
          maxZoom={8}
        >
          {/* Layer 1: World country outlines (base map) */}
          <Geographies geography={COUNTRIES_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="rgba(255, 255, 255, 0.05)"
                  stroke="rgba(255, 255, 255, 0.10)"
                  strokeWidth={0.3}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Layer 2: Province boundaries from admin-1 TopoJSON */}
          <Geographies geography={PROVINCES_URL}>
            {({ geographies }) =>
              geographies
                .filter((geo) => countrySet.has(geo.properties.c))
                .map((geo) => {
                  const isHighlighted = shouldHighlightProvince(geo, regions);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isHighlighted ? accent : 'transparent'}
                      fillOpacity={isHighlighted ? 0.4 : 0}
                      stroke={isHighlighted ? accent : 'rgba(255, 255, 255, 0.06)'}
                      strokeWidth={isHighlighted ? 0.6 : 0.2}
                      strokeOpacity={isHighlighted ? 0.8 : 0.3}
                      style={{
                        default: { outline: 'none' },
                        hover: {
                          outline: 'none',
                          fill: isHighlighted ? accent : 'transparent',
                          fillOpacity: isHighlighted ? 0.55 : 0,
                        },
                        pressed: { outline: 'none' },
                      }}
                    />
                  );
                })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}

/**
 * Exported wrapper — BrowserOnly for SSR safety.
 */
export default function RegionMap({ regions, accentColor }) {
  if (!regions || regions.length === 0) return null;

  return (
    <BrowserOnly fallback={<div className={styles.mapContainer} />}>
      {() => <RegionMapInner regions={regions} accentColor={accentColor} />}
    </BrowserOnly>
  );
}
