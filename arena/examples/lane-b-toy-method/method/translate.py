#!/usr/bin/env python3
"""Lane B toy method — the synthetic qaa>qab rule, stdin to stdout.

The organizer node runs a Lane B bundle as

    cat /eval/source.txt | python3 /method/translate.py > /output/translations.txt

inside a --network=none, read-only container: one source sentence per input
line, one translation per output line, same order, nothing else on stdout.

The "language pair" is the harness's INVENTED synthetic fixture (qaa/qab are
ISO 639-2 reserved-for-local-use codes). Its whole grammar is one rule:

    w1 w2 w3 ...  ->  w2 w1vo

i.e. the second word comes first, then the first word with the suffix "vo";
any further words are dropped. A line with fewer than two words is echoed
unchanged. There is no lookup table and no data file: the rule IS the method,
which is why it scores ~100 against the synthetic references by construction
and proves only that the pipe works, never anything about translation.

Imports only `sys` — the node's static scan (sandbox spec §3.1) blocks network
libraries and warns on environment reads; a method that needs neither is the
honest baseline for the contract.
"""

import sys


def translate(line: str) -> str:
    words = line.split()
    if len(words) >= 2:
        return f"{words[1]} {words[0]}vo"
    return line.strip()


def main() -> int:
    for line in sys.stdin:
        print(translate(line))
    return 0


if __name__ == "__main__":
    sys.exit(main())
