/**
 * release.mjs — whether the rails are released, read from
 * src/data/rails-demo/release.json (see its _comment). One place decides
 * whether the pages say "not released yet", and which versions their commands
 * pin once they are released. Throws — never guesses — when the file says
 * "released" without naming every version.
 */
import REL from '../../data/rails-demo/release.json';

export const PACKAGES = ['champollion', 'champollion-mcp-server', 'nmt-forge', 'mt-eval-harness'];

export function releaseState(rel = REL) {
  if (typeof rel.railsReleased !== 'boolean') throw new Error('release.json: railsReleased must be true or false');
  if (rel.railsReleased) {
    const missing = PACKAGES.filter((p) => !rel.railsVersions || !rel.railsVersions[p]);
    if (missing.length) throw new Error(`release.json says the rails are released but names no version for: ${missing.join(', ')}`);
  }
  return {
    released: rel.railsReleased,
    checked: rel.checked,
    published: rel.published,
    versions: rel.railsVersions,
    /** `name` or, once released, `name@version` — so a command pins what it describes */
    pin: (name) => (rel.railsReleased ? `${name}@${rel.railsVersions[name]}` : name),
  };
}

export const RELEASE = releaseState();
