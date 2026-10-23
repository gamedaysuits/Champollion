/**
 * commands.mjs — every command the rails pages show, in one place.
 *
 * Each is a `cmd:` value so scripts/check_doc_commands.py (the pre-push
 * docs-truth gate, site mode) checks it against the real CLI routing map and
 * the real mt-eval / nmt-forge parsers. A command a page shows that is not
 * here must be in recording.json (checked by railsDemo.test.mjs and the
 * recorder's --check) — never typed into a page.
 *
 * `<…>` is a placeholder the reader fills in. Commands are never translated.
 */
export const C = {
  installCli: {cmd: 'npm install -g champollion'},
  installForge: {cmd: 'uv tool install --python 3.12 nmt-forge'},
  installHarness: {cmd: 'pipx install mt-eval-harness'},
  mcp: {cmd: 'npx -y champollion-mcp-server'},
  newGeneric: {cmd: 'champollion new my-project --from English --to <language>'},
  newFamily: {cmd: 'champollion new family --from English --to qaa --target-name "Our language"'},
  next: {cmd: 'champollion next'},
  validate: {cmd: 'champollion validate'},
  addPairs: {cmd: 'champollion data add inbox/<file>'},
  addTest: {cmd: 'champollion data add <file> --into test'},
  addLexicon: {cmd: 'champollion data add <file> --into lexicon'},
  mark: {cmd: 'champollion data mark <file> --owner "<holder>" --training allowed --local-only'},
  markNoTrain: {cmd: 'champollion data mark <file> --training not-allowed'},
  combine: {cmd: 'champollion data combine'},
  translate: {cmd: 'mt-eval translate --deployment deploy/<name>.json --source-file <file> --out <file>'},
  serve: {cmd: 'mt-eval serve --deployment deploy/<name>.json'},
  forgeServe: {cmd: 'nmt-forge serve <model-folder>'},
  connect: {cmd: 'champollion connect <model-folder> --app <folder>'},
  offline: {cmd: 'export CHAMPOLLION_OFFLINE=1'},
};

/**
 * The first command for a language a person types, as the rails take it:
 * a name or a code. Nothing is guessed — an unknown name is answered by the
 * rails with close matches for the person to choose. An empty name gives the
 * private-use example (`qaa`, "Our language").
 */
export function newCommand(language, {folder = 'my-project', from = 'English'} = {}) {
  const name = String(language || '').trim();
  if (!name) return C.newFamily.cmd;
  const q = (v) => (/^[A-Za-z0-9_-]+$/.test(v) ? v : `"${v.replace(/(["\\$`])/g, '\\$1')}"`);
  return `champollion new ${folder} --from ${q(from)} --to ${q(name)}`;
}
