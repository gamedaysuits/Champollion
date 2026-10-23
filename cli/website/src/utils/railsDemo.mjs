/**
 * railsDemo.mjs — everything the rails pages SHOW about the recorded walk.
 *
 * The homepage figure and its numbers are "recorded, not written": the tool
 * calls, the commands, what the tools printed and every score come from
 * src/data/rails-demo/recording.json (made by
 * scripts/rails_acceptance/record_demo.mjs from a scripted walk of the rails;
 * its --check fails when the tools drift from it). What the person and the
 * agent SAY is written by us, in src/data/rails-demo/script.json, and the
 * page labels it as written.
 *
 * Two rules this module enforces, so a page cannot quietly break them:
 *   1. A number is read from the recording, never typed. `facts()` parses each
 *      one out of the recorded text and THROWS when it cannot — a re-recorded
 *      walk that changes shape breaks the build, it never shows a stale figure.
 *   2. A command is shown only by reference into the recording. A chapter in
 *      script.json names its steps with matchers (`{tool, path}`, `{ask}`,
 *      `{ran}`); a matcher that finds nothing, or finds a different step than
 *      before, throws.
 *
 * Pure: no DOM, no fs. Node tests: railsDemo.test.mjs.
 */

const NUM = '(\\d+(?:\\.\\d+)?)';
const CI = `${NUM} \\[${NUM}, ${NUM}\\]`;

function fail(what) {
  throw new Error(`railsDemo: ${what} — the recording changed shape; re-read it before the page shows anything`);
}

function must(re, text, what) {
  const m = re.exec(text || '');
  if (!m) fail(`could not read ${what}`);
  return m;
}

const score = (m, at) => ({score: Number(m[at]), lo: Number(m[at + 1]), hi: Number(m[at + 2])});

/** Every command the rails ran, in order: {i, command, output}. */
export function ranCommands(rec) {
  const out = [];
  rec.steps.forEach((s, i) => (s.ran || []).forEach((r) => out.push({i, command: r.command, output: r.output, exit: r.exit_code})));
  return out;
}

function ranStarting(rec, prefix) {
  const hit = ranCommands(rec).find((r) => r.command.startsWith(prefix));
  if (!hit) fail(`no command starting "${prefix}"`);
  return hit;
}

function askStep(rec, ref) {
  const s = rec.steps.find((x) => x.step && x.step.ref === ref);
  if (!s) fail(`no step "${ref}"`);
  return s.step;
}

/**
 * The facts the pages quote, each parsed from what the tools printed.
 * Throws when any is missing.
 */
export function facts(rec) {
  if (!rec || !Array.isArray(rec.steps) || !/^RECORDED, not written/.test(rec._comment || '')) {
    fail('not a rails recording');
  }
  const files = rec.steps
    .filter((s) => s.tool === 'add_data' && s.result && s.result.result)
    .map((s) => {
      const m = must(/→ (\S+): (\d+) pair\(s\)/, s.result.result, `the pairs added from ${s.args && s.args.path}`);
      return {from: s.args.path, to: m[1], pairs: Number(m[2]), into: s.args.into || 'parallel'};
    });
  if (files.length === 0) fail('no add_data step');

  const audit = ranStarting(rec, 'nmt-forge leak-audit');
  const tw = must(/(\d+) of (\d+) test rows \((\d+)%\) have a near-twin/, audit.output, 'the near-twin screen');

  const prereg = rec.steps.find((s) => s.args && s.args.step_id && s.args.step_id.startsWith('predict:'));
  if (!prereg || !prereg.args.answers || !prereg.args.answers.expect) fail('the prediction');

  const floorRun = ranStarting(rec, 'nmt-forge floor');
  const fl = must(new RegExp(`dictionary floor on dev set \\S+ \\((\\d+) sentences[^)]*\\): chrF\\+\\+ ${CI}`), floorRun.output, 'the dictionary floor');
  const reach = must(/reached (\d+) of (\d+) source words \((\d+)%\)/, floorRun.output, 'the dictionary reach');

  const finalWarn = rec.steps.flatMap((s) => s.warnings || []).find((w) => /does not beat the dictionary floor/.test(w));
  const dev = must(new RegExp(`dev chrF\\+\\+ ${CI} does not beat the dictionary floor`), finalWarn, 'the model\'s dev score against the floor');

  const judge = askStep(rec, 'judge');
  const test = must(new RegExp(`scored chrF\\+\\+ ${CI} on their checked sentences`), judge.question, 'the test score');

  const verdictRun = rec.steps.find((s) => s.args && s.args.step_id && s.args.step_id.startsWith('judge:'));
  if (!verdictRun || !verdictRun.args.answers) fail('the verdict');

  const init = ranStarting(rec, 'nmt-forge init');
  const expect = must(/expect: (on ~[^\n]+)/, init.output, 'forge\'s expectation for a tiny model');
  const model = must(/model:\s+(\S+) — backend/, init.output, 'the model preset');

  const train = ranStarting(rec, 'nmt-forge run');
  const bounds = must(/bounds: ([^\n]+)/, train.output, 'the training job\'s bounds');

  const testDouble = rec.steps.some((s) => s.kind === 'person' && /backend = dummy/.test(s.did || ''));

  const split = ranStarting(rec, 'nmt-forge split');
  // "dev: N of M dev rows (P%) have a near-twin …", or — since the dev split
  // grew (program plan A1) — "dev: no dev row has a near-twin …": none, of the
  // dev sentences the floor was measured on
  const none = /dev: no dev row has a near-twin/.test(split.output);
  const dt = none ? [null, '0', fl[1], '0']
    : must(/dev: (\d+) of (\d+) dev rows \((\d+)%\) have a near-twin/, split.output, 'the dev set\'s near-twins');
  // the harness's own small-sample warning ("poor coverage below N entries")
  const small = must(/Only (\d+) entries in this sample — bootstrap CIs for chrf\+\+ may have poor coverage below (\d+) entries/, floorRun.output, 'the small-sample warning');

  return {
    recordedWith: rec.recorded_with,
    pair: rec.pair,
    files,
    trainingFiles: files.filter((f) => f.into === 'parallel'),
    lexicon: files.find((f) => f.into === 'lexicon') || null,
    test: files.find((f) => f.into === 'test') || fail('no test file'),
    twins: {n: Number(tw[1]), of: Number(tw[2]), pct: Number(tw[3])},
    prediction: {expect: prereg.args.answers.expect, why: prereg.args.answers.why},
    floor: {...score(fl, 2), devSentences: Number(fl[1]), reached: Number(reach[1]), words: Number(reach[2]), pct: Number(reach[3])},
    devModel: score(dev, 1),
    testModel: score(test, 1),
    verdict: {verdict: verdictRun.args.answers.verdict, by: verdictRun.args.answers.by},
    preset: model[1],
    expect: expect[1].trim(),
    bounds: bounds[1].trim(),
    testDouble,
    devTwins: {n: Number(dt[1]), of: Number(dt[2]), pct: Number(dt[3])},
    smallSample: {n: Number(small[1]), below: Number(small[2])},
  };
}

/** True when two confidence intervals overlap (the page never ranks these). */
export const overlaps = (a, b) => a.lo <= b.hi && b.lo <= a.hi;

/**
 * Resolve one matcher from script.json to a recording step index.
 *   {tool, path?}  — a tool call (add_data by its path)
 *   {ask}          — the first status whose step is that ref and asks
 *                    something of the person (any mode but auto)
 *   {status}       — the first status whose step is that ref, any mode
 *   {ran}          — the step that ran a command starting with this text
 *   {person}       — what the scripted person did, by a phrase in it
 */
export function resolveRef(rec, ref) {
  let i = -1;
  if (ref.ran) i = rec.steps.findIndex((s) => (s.ran || []).some((r) => r.command.startsWith(ref.ran)));
  else if (ref.ask) i = rec.steps.findIndex((s) => s.step && s.step.ref === ref.ask && s.step.mode !== 'auto');
  else if (ref.status) i = rec.steps.findIndex((s) => s.step && s.step.ref === ref.status);
  else if (ref.person) i = rec.steps.findIndex((s) => s.kind === 'person' && (s.did || '').includes(ref.person));
  else if (ref.tool) i = rec.steps.findIndex((s) => s.tool === ref.tool && (!ref.path || (s.args && s.args.path === ref.path)));
  if (i < 0) fail(`no step matches ${JSON.stringify(ref)}`);
  return i;
}

const MAX_OUT = 6;

/**
 * The recorder stores a command as its arguments joined by spaces (the rails
 * run it from an argument list, never through a shell), so `--owner the
 * family` arrives as three words. Shown with a `$` prompt it must still be a
 * command a person could paste: a flag's value of several words is quoted.
 * In every recorded command a flag takes at most one value, so the words
 * between one flag and the next ARE that value.
 */
export function shellQuote(command) {
  const words = String(command).split(' ');
  const out = [];
  for (let k = 0; k < words.length; k++) {
    const w = words[k];
    out.push(w);
    if (!w.startsWith('--')) continue;
    const value = [];
    while (k + 1 < words.length && !words[k + 1].startsWith('--')) value.push(words[++k]);
    if (value.length === 1) out.push(/[\s"'$`<>|&;()*?]/.test(value[0]) ? `'${value[0]}'` : value[0]);
    else if (value.length > 1) out.push(`"${value.join(' ').replace(/(["\\$`])/g, '\\$1')}"`);
  }
  return out.join(' ');
}

/** Terminal lines for one recorded step (what the window's terminal shows). */
export function terminalLines(rec, i, {only} = {}) {
  const s = rec.steps[i];
  const lines = [];
  if (s.kind === 'person') return [{kind: 'did', text: s.did}];
  const clip = (text) => {
    const all = String(text || '').split('\n').filter((l) => l.trim() !== '');
    const shown = all.slice(0, MAX_OUT).map((t) => ({kind: 'out', text: t}));
    if (all.length > MAX_OUT) shown.push({kind: 'more', text: `… ${all.length - MAX_OUT} more line(s) in the transcript below`});
    return shown;
  };
  if (s.ran && s.ran.length) {
    for (const r of s.ran) {
      if (only && !r.command.startsWith(only)) continue;
      lines.push({kind: 'cmd', text: shellQuote(r.command)});
      lines.push(...clip(r.output));
    }
    return lines;
  }
  if (s.tool) {
    const args = {...(s.args || {})};
    delete args.project_dir;
    lines.push({kind: 'tool', text: `${s.tool} ${JSON.stringify(args)}`});
    if (s.result && s.result.result) lines.push(...clip(s.result.result));
    if (s.step && s.step.question) lines.push({kind: 'ask', text: s.step.question});
    else if (s.step && s.step.say && s.step.mode === 'confirm') lines.push({kind: 'ask', text: s.step.say});
    else if (s.step && s.step.say && s.step.mode === 'human_only') lines.push({kind: 'note', text: s.step.say});
    for (const w of s.warnings || []) lines.push({kind: 'warn', text: w});
  }
  return lines;
}

/** Which data files exist after step `upto`, and how each is held. */
export function filesAt(rec, upto) {
  const files = new Map();
  rec.steps.slice(0, upto + 1).forEach((s) => {
    if (s.tool === 'add_data' && s.result && s.result.result) {
      const m = /→ (\S+):/.exec(s.result.result);
      if (m) files.set(m[1], {path: m[1], lock: /local-only/.test(s.result.result) ? 'default' : null, decided: false});
    }
    for (const r of s.ran || []) {
      const mark = /^champollion data mark (\S+).*--local-only/.exec(r.command);
      if (mark && files.has(mark[1])) files.set(mark[1], {...files.get(mark[1]), lock: 'decided', decided: true});
      if (/^nmt-forge registry add \S+ (\S+) --role test/.test(r.command)) {
        const p = /^nmt-forge registry add \S+ (\S+)/.exec(r.command)[1];
        if (files.has(p)) files.set(p, {...files.get(p), counted: true});
      }
    }
  });
  return [...files.values()];
}

/**
 * The figure's chapters: each carries the written lines (script.json), the
 * recorded terminal lines it references, and the files as they stand after
 * its last step. Throws if a chapter references nothing or goes backwards.
 */
export function chapters(rec, script) {
  let last = -1;
  return script.chapters.map((ch) => {
    const idx = ch.refs.map((r) => resolveRef(rec, r));
    if (idx.length === 0) fail(`chapter ${ch.id} references no step`);
    const end = Math.max(...idx);
    if (end < last) fail(`chapter ${ch.id} goes back in the recording`);
    last = end;
    const terminal = ch.refs.flatMap((r, k) => terminalLines(rec, idx[k], {only: r.ran}));
    return {
      id: ch.id,
      title: ch.title,
      lines: ch.lines,
      answers: ch.answersFrom ? rec.steps[resolveRef(rec, ch.answersFrom)].args.answers : null,
      terminal,
      files: filesAt(rec, end),
      at: end,
    };
  });
}

/** Every recorded step as plain text, for the no-JS transcript. */
export function transcript(rec) {
  return rec.steps.map((s, i) => {
    if (s.kind === 'person') return {i, who: 'person', text: s.did};
    const lines = terminalLines(rec, i).map((l) => (l.kind === 'more' ? null : l)).filter(Boolean);
    // the transcript shows outputs in full, not clipped
    if (s.ran && s.ran.length) {
      return {i, who: 'rails', text: s.ran.map((r) => `$ ${shellQuote(r.command)}\n${r.output}`).join('\n\n')};
    }
    const full = [];
    full.push(`→ ${lines[0] ? lines[0].text : s.tool}`);
    if (s.result && s.result.result) full.push(s.result.result);
    if (s.stage) full.push(`stage ${s.stage}`);
    if (s.step && s.step.question) full.push(`asks the person: ${s.step.question}`);
    if (s.step && s.step.mode === 'confirm') full.push(`asks the person to confirm: ${s.step.say}`);
    if (s.step && s.step.mode === 'human_only') full.push(`for a person: ${s.step.say}`);
    for (const w of s.warnings || []) full.push(`warning: ${w}`);
    return {i, who: 'agent', text: full.join('\n')};
  });
}
