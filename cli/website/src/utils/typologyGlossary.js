/**
 * typologyGlossary.js — THIN RE-EXPORT LAYER
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  THIS FILE IS A REDIRECT.                                              ║
 * ║  All concept definitions live in linguisticGlossary.js (the SSOT).    ║
 * ║  This file re-exports the same API so existing imports don't break.   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Previously this file contained 30+ inline glossary entries.
 * Those have been migrated to linguisticGlossary.js to maintain
 * a Single Source of Truth for all linguistic concept explanations.
 */

export { getFeatureInfo, getFeatureDisplayName } from './linguisticGlossary';
