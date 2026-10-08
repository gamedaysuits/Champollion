"""
Dashboard Watch Mode — polls a directory for new/changed report files
and regenerates the dashboard automatically.

Uses simple polling (no external dependencies like watchdog).
Check interval defaults to 5 seconds.

Usage:
    python -m mt_eval_harness.watch eval_demo/ -o eval_demo/dashboard.html
    # or via CLI:
    mt-eval dashboard eval_demo/ -o eval_demo/dashboard.html --watch
"""

import os
import sys
import time
import glob
from pathlib import Path

from .dashboard import load_reports, generate


def watch(
    directory: str,
    output: str = "dashboard.html",
    interval: float = 5.0,
):
    """
    Watch a directory for report file changes and regenerate dashboard.

    Polls for *_report.json files every `interval` seconds.
    Regenerates the dashboard whenever the set of files or their mtimes change.
    """
    directory = os.path.abspath(directory)
    pattern = os.path.join(directory, "*_report.json")

    print(f"  Watching: {directory}")
    print(f"  Output:   {output}")
    print(f"  Interval: {interval}s")
    print(f"  Press Ctrl+C to stop\n")

    last_snapshot = {}

    while True:
        try:
            # Build current snapshot: {filepath: mtime}
            current = {}
            for f in sorted(glob.glob(pattern)):
                try:
                    current[f] = os.path.getmtime(f)
                except OSError:
                    pass

            # Compare to previous snapshot
            if current != last_snapshot:
                n_files = len(current)
                new_files = set(current.keys()) - set(last_snapshot.keys())
                changed = set(
                    f for f in current
                    if f in last_snapshot and current[f] != last_snapshot[f]
                )

                if last_snapshot:
                    # Not the first run — describe what changed
                    parts = []
                    if new_files:
                        parts.append(f"{len(new_files)} new")
                    if changed:
                        parts.append(f"{len(changed)} updated")
                    print(f"  [{time.strftime('%H:%M:%S')}] {', '.join(parts)} — regenerating ({n_files} reports)")
                else:
                    print(f"  [{time.strftime('%H:%M:%S')}] Initial scan — {n_files} report(s)")

                last_snapshot = current

                if n_files > 0:
                    try:
                        reports = load_reports([directory])
                        out = generate(reports, output)
                        print(f"  [{time.strftime('%H:%M:%S')}] Dashboard written to: {out}")
                    except Exception as e:
                        print(f"  [{time.strftime('%H:%M:%S')}] ERROR: {e}")
                else:
                    print(f"  [{time.strftime('%H:%M:%S')}] No report files found yet...")

            time.sleep(interval)

        except KeyboardInterrupt:
            print("\n  Watch stopped.")
            break


def main():
    """CLI entry point for watch mode."""
    args = sys.argv[1:]
    output = "dashboard.html"
    interval = 5.0
    directory = None

    i = 0
    while i < len(args):
        if args[i] in ("-o", "--output") and i + 1 < len(args):
            output = args[i + 1]
            i += 2
        elif args[i] in ("-i", "--interval") and i + 1 < len(args):
            interval = float(args[i + 1])
            i += 2
        elif directory is None:
            directory = args[i]
            i += 1
        else:
            i += 1

    if not directory:
        print("Usage: watch <directory> [-o output.html] [-i interval_seconds]")
        sys.exit(1)

    watch(directory, output, interval)


if __name__ == "__main__":
    main()
