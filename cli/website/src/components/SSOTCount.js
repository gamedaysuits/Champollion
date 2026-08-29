import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

/**
 * SSOTCount — renders a build-time count from docusaurus.config.js
 * `customFields` (which reads the machine SSOTs: shared/licenses.json,
 * arena/datasets/registry.json, cli/shared/language-cards/). House standard
 * (CLAUDE.md "Data over code"; founder 2026-07-19): displayed values are
 * never hand-typed — pages and MDX docs render this component instead of a
 * literal, so the number cannot drift from its source.
 *
 * FAIL LOUD: an unknown/non-numeric field throws during SSR, which fails the
 * production build. No fallback constants, ever.
 *
 * Usage (MDX):  import SSOTCount from '@site/src/components/SSOTCount';
 *               <SSOTCount field="licensedSourceCount" />
 */
export default function SSOTCount({field}) {
  const {siteConfig} = useDocusaurusContext();
  const value = siteConfig.customFields?.[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `[SSOTCount] customFields.${field} is not a number — add/fix the SSOT read in docusaurus.config.js`,
    );
  }
  return <>{value.toLocaleString('en-US')}</>;
}
