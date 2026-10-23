/**
 * service-api/1 — the /translate contract, checked on the client side.
 *
 * One contract between a translation service and what calls it, written down
 * once in shared/schemas/framework/service-api.v1.schema.json (bundled under
 * shared/). Servers: nmt-forge serve, mt-eval serve, or anyone's; client:
 * lib/methods/api.js. The Python twin, which also runs the shared vectors
 * against a live server, is arena/mt_eval_harness/framework/service_api.py.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validate } from '../mini-schema.mjs';

export const SERVICE_API_ID = 'https://champollion.dev/schemas/service-api/1.json';
export const PARTS = Object.freeze(['translate_request', 'translate_response', 'error_response', 'health']);

const FILE = fileURLToPath(new URL('../../shared/schemas/framework/service-api.v1.schema.json', import.meta.url));
let schema = null;

/** Errors (empty when it holds) for `body` as one part of the contract. */
export function checkServiceBody(body, part) {
  if (!PARTS.includes(part)) {
    throw new Error(`unknown service-api/1 part '${part}' (known: ${PARTS.join(', ')})`);
  }
  if (!schema) {
    try {
      schema = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    } catch (e) {
      throw new Error(`${FILE} is missing (${e.code || e.message}); reinstall champollion from a tagged release.`);
    }
  }
  return validate(body, { $ref: `#/$defs/${part}`, $defs: schema.$defs }).errors;
}
