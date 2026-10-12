/**
 * One wording for a cost estimate, wherever a price is named beside a command
 * or an answer: the redo notes of `sync`, the named-key cache note, and the
 * MCP server's `translate` answer (Round 9: the MCP said "0 USD" for a model
 * on this machine, where the CLI says "$0 API cost (runs on this machine)").
 *
 * Pure, no imports: the MCP server reads it from the package's exports.
 *
 * The estimate is the object a method's estimateCost() returns
 * ({ estimatedCost: number|null, local?: true, … }):
 *   - a model served on this machine (local: true, $0)  → "$0 API cost (runs on this machine)"
 *   - a known price                                     → "est. ~$0.0123"
 *   - no published price (null), or no estimate at all  → "cost unknown — no published price" / "cost unknown"
 */

/** What a model on this machine costs, in the words every surface uses. */
export const LOCAL_COST_LABEL = '$0 API cost (runs on this machine)';

/**
 * @param {{ estimatedCost?: number|null, local?: boolean }|null|undefined} estimate
 * @returns {string}
 */
export function costLabel(estimate) {
  if (!estimate || typeof estimate !== 'object') return 'cost unknown';
  const cost = estimate.estimatedCost;
  if (estimate.local && cost === 0) return LOCAL_COST_LABEL;
  if (typeof cost === 'number' && Number.isFinite(cost)) return `est. ~$${cost.toFixed(4)}`;
  return 'cost unknown — no published price';
}
