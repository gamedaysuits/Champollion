#!/usr/bin/env python3
"""check_doc_commands.py — every command the public docs show must exist.

The 2026-10-02 journey survey found the docs telling people to run commands
and flags that do not exist (`mt-eval run --private`, `mt-eval login`), and an
unquoted `--pair eng>crk` that makes the shell write a file called `crk`.
Each one is a dead end for a newcomer, and for an agent that trusts the docs.

This gate reads every fenced code block and inline code span in the PUBLIC
docs (cli/website/docs, English) and, for each `champollion …` / `npx
champollion …` / `mt-eval …` / `nmt-forge …` invocation, checks:

  - the command / subcommand exists (champollion: the routing map in
    cli/bin/cli.js; mt-eval and nmt-forge: their real argparse parsers);
  - every --flag exists (champollion: CLI_OPTIONS; mt-eval / nmt-forge: the
    flags of that exact subcommand, including inherited ones);
  - no unquoted `x>y` / `x<y` inside an argument (a shell redirect).

Placeholders like `<run-id>` and `<code>` are allowed. A line can opt out with
a trailing `# doc-commands: ignore` comment (use sparingly, with a reason).

Exit 0 = clean, 1 = problems (listed), 2 = could not load a parser.
"""

from __future__ import annotations

import argparse
import re
import shlex
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / 'cli' / 'website' / 'docs'
PREFIXES = ('npx champollion', 'champollion', 'mt-eval', 'nmt-forge')
FENCE = re.compile(r'^(\s*)(```|~~~)([\w-]*)')
INLINE = re.compile(r'`([^`\n]+)`')
REDIRECT = re.compile(r'''(?<![<'"\\])\b[\w.-]+[<>][A-Za-z][\w-]*''')
PLACEHOLDER = re.compile(r'<[^<>\s]+>')
SENTINEL = '__placeholder__'
# Fences whose lines are commands. Unlabelled fences are usually output
# (banners, trees, logs) — but people also paste commands into them, so they
# are checked too, minus lines that are plainly output (a version banner).
SHELL_LANGS = {'', 'bash', 'sh', 'shell', 'zsh', 'console', 'powershell', 'ps1', 'cmd'}


# ── command models ─────────────────────────────────────────────────────────

def champollion_model():
    src = (ROOT / 'cli' / 'bin' / 'cli.js').read_text(encoding='utf-8')
    opts_block = src[src.index('const CLI_OPTIONS'):]
    opts_block = opts_block[:opts_block.index('\n};')]
    flags = set(re.findall(r"^\s*'?([a-z][\w-]*)'?\s*:\s*\{", opts_block, re.M))
    shorts = set(re.findall(r"short:\s*'(\w)'", opts_block))
    cmd_block = src[src.index('const commands = {'):]
    cmd_block = cmd_block[:cmd_block.index('};')]
    commands = set(re.findall(r"^\s*'?([a-z][\w-]*)'?\s*:", cmd_block, re.M)) | {'help'}
    groups_match = re.search(r'const COMMAND_GROUPS = \{([\s\S]*?)\n\};', src)
    groups = {}
    if groups_match:
        for g, body in re.findall(r"(\w+):\s*\[([^\]]*)\]", groups_match.group(1)):
            groups[g] = set(re.findall(r"'([\w-]+)'", body))
    return {'flags': flags, 'shorts': shorts, 'commands': commands, 'groups': groups}


def argparse_model(import_path: str, module: str):
    sys.path.insert(0, str(ROOT / import_path))
    try:
        mod = __import__(module, fromlist=['build_parser'])
        return mod.build_parser()
    except Exception as exc:  # pragma: no cover — reported, exit 2
        print(f'[ERR] could not build the {module} parser: {exc}', file=sys.stderr)
        sys.exit(2)


def _subparsers(parser):
    for action in parser._actions:
        if isinstance(action, argparse._SubParsersAction):
            return action.choices
    return {}


def _flags(parser):
    out = set()
    for action in parser._actions:
        out.update(o for o in action.option_strings)
    return out


# ── checks ─────────────────────────────────────────────────────────────────

def check_argparse(tokens, parser, tool):
    problems = []
    current, inherited = parser, _flags(parser)
    path = [tool]
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        subs = _subparsers(current)
        if tok.startswith('-'):
            flag = tok.split('=', 1)[0]
            if flag not in inherited | _flags(current) and not PLACEHOLDER.fullmatch(flag):
                problems.append(f'`{" ".join(path)}` has no flag {flag}')
        elif subs and not PLACEHOLDER.search(tok):
            if tok in subs:
                current = subs[tok]
                inherited |= _flags(current)
                path.append(tok)
            else:
                problems.append(f'`{" ".join(path)}` has no subcommand `{tok}` '
                                f'(has: {", ".join(sorted(subs))})')
                break
        i += 1
    return problems


def check_champollion(tokens, model):
    problems = []
    if not tokens:
        return problems
    cmd = tokens[0]
    rest = tokens[1:]
    if cmd.startswith('-'):
        rest = tokens
    elif cmd in model['groups']:
        if rest and not rest[0].startswith('-') and rest[0] not in model['groups'][cmd]:
            problems.append(f'`champollion {cmd}` has no command `{rest[0]}`')
        rest = rest[1:]
    elif cmd not in model['commands'] and not PLACEHOLDER.search(cmd):
        problems.append(f'champollion has no command `{cmd}`')
    for tok in rest:
        if tok.startswith('--'):
            flag = tok[2:].split('=', 1)[0]
            if flag.startswith('no-') and flag[3:] in model['flags']:
                continue
            if flag not in model['flags']:
                problems.append(f'champollion has no flag --{flag}')
        elif re.fullmatch(r'-[A-Za-z]', tok) and tok[1] not in model['shorts']:
            problems.append(f'champollion has no flag {tok}')
    return problems


def commands_in(path: Path):
    """Yield (line_no, command_text) for every tool invocation in a doc."""
    lines = path.read_text(encoding='utf-8').splitlines()
    in_fence, buf, start, lang = False, '', 0, ''
    for n, raw in enumerate(lines, 1):
        m = FENCE.match(raw)
        if m:
            in_fence = not in_fence
            lang = m.group(3).lower() if in_fence else ''
            continue
        if in_fence and lang in SHELL_LANGS:
            line = raw.strip()
            if buf:
                buf += ' ' + line
            else:
                buf, start = line, n
            if buf.endswith('\\'):
                buf = buf[:-1]
                continue
            yield start, buf
            buf = ''
        else:
            for span in INLINE.findall(raw):
                yield n, span.strip()


def split_invocation(text: str):
    text = text.lstrip('$ ').strip()
    if 'doc-commands: ignore' in text:
        return None
    text = re.split(r'\s+#\s', text)[0]          # trailing comment
    for sep in ('&&', '||', ';', '|'):
        text = text.split(sep)[0]
    for prefix in PREFIXES:
        if text == prefix or text.startswith(prefix + ' '):
            return prefix, text[len(prefix):].strip()
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--docs', default=str(DOCS))
    args = ap.parse_args()

    champ = champollion_model()
    mteval = argparse_model('arena', 'mt_eval_harness.cli')
    forge = argparse_model('forge', 'nmt_forge.cli')

    problems = []
    for doc in sorted(Path(args.docs).rglob('*.md*')):
        if '/i18n/' in str(doc):
            continue
        for line_no, text in commands_in(doc):
            inv = split_invocation(text)
            if not inv:
                continue
            tool, rest = inv
            where = f'{doc.relative_to(ROOT) if doc.is_relative_to(ROOT) else doc}:{line_no}'
            # Unquoted redirect characters inside arguments.
            bare = re.sub(r"'[^']*'|\"[^\"]*\"", '', PLACEHOLDER.sub('', rest))
            if REDIRECT.search(bare):
                problems.append(f'{where}: unquoted < or > in `{text}` — the shell treats it as a redirect')
                continue
            if re.match(r'v?\d+\.\d+', rest):
                continue  # a version banner in an output block, not a command
            try:
                tokens = shlex.split(PLACEHOLDER.sub(SENTINEL, rest))
            except ValueError:
                continue
            tokens = [t for t in tokens if SENTINEL not in t or t.startswith('-')]
            if tool.endswith('champollion'):
                found = check_champollion(tokens, champ)
            elif tool == 'mt-eval':
                found = check_argparse(tokens, mteval, 'mt-eval')
            else:
                found = check_argparse(tokens, forge, 'nmt-forge')
            problems.extend(f'{where}: {p}' for p in found)

    if problems:
        print(f'check_doc_commands: {len(problems)} problem(s) in the public docs\n')
        for p in problems:
            print(f'  {p}')
        sys.exit(1)
    print('check_doc_commands: every documented command and flag exists')


if __name__ == '__main__':
    main()
