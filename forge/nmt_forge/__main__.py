"""`python -m nmt_forge <command>` — the same CLI as `nmt-forge` (used by
detached jobs, which must not depend on the entry point being on PATH)."""

import sys

from .cli import main

sys.exit(main())
