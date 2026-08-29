import React, { useEffect, useState } from "react";
import Link from "@docusaurus/Link";

import styles from "./HumanServicesForPair.module.css";
import { fetchServicesForPair } from "../utils/humanServices";

// Public Supabase config — safe to embed (RLS gates reads to approved +
// consented rows only; see migration 034). Mirrors leaderboard.js.
const SUPABASE_URL = "https://sjdomynysdljkbemupqa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp";

/**
 * Per-pair human-translation affordance — the "human method" floor for pairs
 * with no reliable MT (docs/HUMAN_SERVICES_HUB.md). Rendered beside the per-pair
 * confidence display. Reads the consent-gated registry via get_services_for_pair.
 *
 * States:
 *   - loading        → quiet "checking…" line
 *   - rows returned  → "No reliable machine translation — these human services
 *                       cover <pair>" + service cards (display name, turnaround,
 *                       rate, community badge)
 *   - 0 rows / RPC not deployed (200 or 404)
 *                    → honest empty state: "no human services listed … register one"
 *                      (a missing RPC, e.g. pre-migration-034, reads as an empty
 *                       registry — see fetchServicesForPair)
 *   - genuine error (5xx / network)
 *                    → render nothing — never a broken/misleading panel
 *
 * @param {object} props
 * @param {string} props.src       - ISO 639-3 source code
 * @param {string} props.tgt       - ISO 639-3 target code
 * @param {string} props.pairLabel - Human-readable pair label (e.g. "English → Plains Cree")
 * @param {string} [props.supabaseUrl]
 * @param {string} [props.anonKey]
 */
export default function HumanServicesForPair({
  src,
  tgt,
  pairLabel,
  supabaseUrl = SUPABASE_URL,
  anonKey = SUPABASE_ANON_KEY,
}) {
  const [state, setState] = useState({ status: "loading", services: [] });

  useEffect(() => {
    if (!src || !tgt) return undefined;
    const controller = new AbortController();
    setState({ status: "loading", services: [] });

    fetchServicesForPair({
      supabaseUrl,
      anonKey,
      src,
      tgt,
      signal: controller.signal,
    })
      .then((services) => {
        if (!controller.signal.aborted) setState({ status: "ready", services });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        // Genuine failure (5xx / network) → hide the panel rather than show a
        // broken or misleading state. A 404 / missing RPC does NOT land here —
        // fetchServicesForPair maps it to an empty registry so the honest empty
        // state renders instead.
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug("[HumanServicesForPair] registry unavailable:", err.message);
        }
        setState({ status: "error", services: [] });
      });

    return () => controller.abort();
  }, [src, tgt, supabaseUrl, anonKey]);

  const label = pairLabel || `${src} → ${tgt}`;

  // Hide entirely until we know something to say (and on hard errors).
  if (state.status === "loading") {
    return (
      <section className={styles.panel} id="human-services" aria-busy="true">
        <p className={styles.checking}>Checking for human translation services for {label}…</p>
      </section>
    );
  }

  if (state.status === "error") {
    return null;
  }

  const { services } = state;

  return (
    <section className={styles.panel} id="human-services">
      {services.length > 0 ? (
        <>
          <div className={styles.header}>
            <span className={styles.floorBadge}>human method</span>
            <h3 className={styles.title}>
              No reliable machine translation — these human services cover {label}
            </h3>
          </div>
          <p className={styles.lede}>
            When no machine route is trustworthy for a pair, the honest answer is a
            human one. These providers are listed only with their explicit consent.
          </p>
          <ul className={styles.list}>
            {services.map((s) => (
              <li key={s.serviceId} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.name}>{s.displayName}</span>
                  {s.badge && (
                    <span className={`${styles.badge} ${styles[`badge_${s.badge.kind}`] || ""}`}>
                      {s.badge.label}
                    </span>
                  )}
                  {s.variety && <span className={styles.variety}>{s.variety}</span>}
                </div>
                <div className={styles.meta}>
                  {s.turnaround && <span className={styles.metaItem}>{s.turnaround}</span>}
                  {s.rate && <span className={styles.metaItem}>{s.rate}</span>}
                  {s.domains.length > 0 && (
                    <span className={styles.metaItem}>{s.domains.join(", ")}</span>
                  )}
                </div>
                {s.ncTerms && <p className={styles.ncTerms}>{s.ncTerms}</p>}
              </li>
            ))}
          </ul>
          <p className={styles.consentNote}>
            Community providers are listed on their own terms (community key
            custodians, in confirmation). <Link to="/human-services">Register a service →</Link>
          </p>
        </>
      ) : (
        <div className={styles.empty} id="human-services-empty">
          <span className={styles.floorBadge}>human method</span>
          <p className={styles.emptyText}>
            No human services listed for {label} yet —{" "}
            <Link to="/human-services">register one</Link>.
          </p>
        </div>
      )}
    </section>
  );
}
