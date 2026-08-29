#!/usr/bin/env python3
"""
SR&ED Time Tracker — Extract Champollion project session data from Antigravity logs.

IMPORTANT: This script ONLY counts sessions that are demonstrably about the
Champollion / MT Eval Arena / crk-translate project. It uses two filters:

  1. FILE FILTER: Did the session touch files under the Champollion project directory
     (current or historical path)?
  2. CONTENT FILTER: Do user requests or file paths contain project-specific
     identifiers (not generic words — specific project names)?

Sessions that match neither filter are excluded, even if they mention generic
terms like "model" or "translation" that could apply to unrelated work.

Output: .vault/09-sred/time-log.md

Usage:
  python3 scripts/sred-time-extract.py                     # Process all
  python3 scripts/sred-time-extract.py --since 2026-06-01  # Since date
  python3 scripts/sred-time-extract.py --dry-run           # Preview only
  python3 scripts/sred-time-extract.py --verbose           # Show rejected sessions
"""

import json
import os
import sys
import glob
import argparse
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

# ── Constants ─────────────────────────────────────────────────────

BRAIN_DIR = os.path.expanduser("~/.gemini/antigravity/brain")
PROJECT_ROOT = os.path.expanduser("~/local projects/Champollion")
# Historical path before monorepo rename (same project, same R&D work)
PROJECT_ROOT_OLD = os.path.expanduser("~/local projects/i18n-autopilot")
OUTPUT_FILE = os.path.join(PROJECT_ROOT, ".vault/09-sred/time-log.md")

# ── Project Scoping ──────────────────────────────────────────────
#
# These are project-specific identifiers — not generic NLP terms.
# A session must match at least one to be included (if it didn't touch
# project files directly). Each must be unlikely to appear in unrelated work.

PROJECT_IDENTIFIERS = [
    # Project names and products
    "champollion", "i18n-rosetta", "i18n-autopilot", "mt-eval", "mt eval",
    "mtevalarena", "crk-translate", "crk_translate",
    # Specific infrastructure
    "eval harness", "eval arena", "run card", "language card",
    "corpora-builder", "corpora_builder",
    # Language-specific (this project's focus)
    "plains cree", "nêhiyaw", "nēhiyawēwin", "crk ", " crk",
    "edtekla", "altlab", "alt lab",
    # Domain-specific architecture
    "fst_accept", "fst-gated", "fst acceptance",
    "morphological_accuracy", "equivalent_match_rate",
    "composite score", "composite_score",
    # Key file/directory names
    "scoring.py", "tester.py", "runner.py", "publish.py",
    "scoring.md", "benchmark-spec", "benchmark spec",
    # Governance — specific to this project's governance model
    "data sovereignty",
    # Project URLs/repos
    "gds-mt-eval", "gamedaysuits/crk", "gamedaysuits/champollion",
]

# ── SR&ED Eligibility Keywords ───────────────────────────────────
#
# ONLY applied to sessions already confirmed as Champollion project work.
# These determine eligible vs partial vs non-eligible within the project.

SRED_KEYWORDS = [
    "fst", "morpholog", "pipeline", "evaluat", "metric", "scoring",
    "tokeniz", "corpus", "corpora", "benchmark", "harness",
    "polysynthetic", "cree", "nêhiyaw", "algonq", "indigenous",
    "confidence interval", "bootstrap", "experiment", "architectur",
    "hallucination", "fst_accept", "chrf", "bleu", "comet",
    "arena", "leaderboard", "run card", "semantic", "embedding",
    "novel", "prototype", "uncertainty", "hypothesis",
]


def parse_transcript(transcript_path):
    """
    Parse a transcript.jsonl file and extract session metadata.

    Returns a dict with session data, or None if unparseable.
    """
    steps = []
    user_requests = []
    project_files = set()      # files under Champollion project dirs
    all_file_paths = set()     # ALL file paths seen in tool calls

    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    step = json.loads(line)
                    steps.append(step)
                except json.JSONDecodeError:
                    continue
    except (OSError, IOError):
        return None

    if not steps:
        return None

    # ── Extract timestamps ──
    timestamps = []
    for step in steps:
        ts = step.get("created_at")
        if ts:
            try:
                ts = ts.replace("Z", "+00:00")
                dt = datetime.fromisoformat(ts)
                timestamps.append(dt)
            except ValueError:
                continue

    if not timestamps:
        return None

    first_ts = min(timestamps)
    last_ts = max(timestamps)
    duration = (last_ts - first_ts).total_seconds() / 60.0

    # ── Extract user requests ──
    for step in steps:
        if step.get("type") == "USER_INPUT" and step.get("source") == "USER_EXPLICIT":
            content = step.get("content", "")
            # Strip XML wrapper tags
            if "<USER_REQUEST>" in content:
                start_idx = content.find("<USER_REQUEST>") + len("<USER_REQUEST>")
                end_idx = content.find("</USER_REQUEST>")
                if end_idx > start_idx:
                    content = content[start_idx:end_idx]
            content = content.strip()[:300]
            if content:
                user_requests.append(content)

    # ── Extract file paths from tool calls ──
    for step in steps:
        tool_calls = step.get("tool_calls", [])
        if isinstance(tool_calls, list):
            for tc in tool_calls:
                args = tc.get("arguments", {})
                if isinstance(args, dict):
                    for key in ["TargetFile", "AbsolutePath", "DirectoryPath",
                                "SearchPath", "Cwd"]:
                        fp = args.get(key, "")
                        if fp:
                            all_file_paths.add(fp)
                            # Check if it's under a known project root
                            if PROJECT_ROOT in fp or PROJECT_ROOT_OLD in fp:
                                rel = fp.replace(PROJECT_ROOT + "/", "")
                                rel = rel.replace(PROJECT_ROOT_OLD + "/", "")
                                project_files.add(rel)

    # Also check model response content for project paths
    for step in steps:
        content = step.get("content", "")
        if isinstance(content, str):
            if PROJECT_ROOT in content or PROJECT_ROOT_OLD in content:
                all_file_paths.add("(in-content-reference)")

    conversation_id = os.path.basename(os.path.dirname(
        os.path.dirname(os.path.dirname(transcript_path))
    ))

    return {
        "conversation_id": conversation_id,
        "first_timestamp": first_ts,
        "last_timestamp": last_ts,
        "duration_minutes": round(duration, 1),
        "user_requests": user_requests,
        "files_modified": sorted(project_files),
        "all_file_paths": all_file_paths,
        "step_count": len(steps),
    }


def is_champollion_session(session):
    """
    Determine whether this session is about the Champollion project.

    Two-gate filter:
      Gate 1 (file paths): Session touched files under the project directory,
        or tool calls referenced project paths.
      Gate 2 (content): User requests contain project-specific identifiers.

    Returns True only if at least one gate passes.
    """
    # Gate 1: Did it touch project files?
    if session["files_modified"]:
        return True

    # Gate 2: Do any file paths reference the project directories?
    for fp in session["all_file_paths"]:
        if PROJECT_ROOT in fp or PROJECT_ROOT_OLD in fp:
            return True

    # Gate 3: Do user requests contain project-specific identifiers?
    full_text = " ".join(session["user_requests"]).lower()
    full_text += " " + " ".join(str(p) for p in session["all_file_paths"]).lower()

    for identifier in PROJECT_IDENTIFIERS:
        if identifier.lower() in full_text:
            return True

    return False


def classify_sred_eligibility(session):
    """
    Heuristic classification of SR&ED eligibility for a Champollion session.

    Only called on sessions already confirmed as project work.
    Returns: 'eligible', 'partial', or 'non-eligible'
    """
    text = " ".join(session["user_requests"]).lower()
    text += " " + " ".join(session["files_modified"]).lower()

    match_count = sum(1 for kw in SRED_KEYWORDS if kw in text)

    if match_count >= 3:
        return "eligible"
    elif match_count >= 1:
        return "partial"
    else:
        return "non-eligible"


def format_session_entry(session):
    """Format a single session as a markdown table row."""
    dt = session["first_timestamp"]
    date_str = dt.strftime("%Y-%m-%d")
    start_str = dt.strftime("%H:%M UTC")
    end_str = session["last_timestamp"].strftime("%H:%M UTC")
    duration = session["duration_minutes"]
    eligibility = classify_sred_eligibility(session)

    summary = session["user_requests"][0] if session["user_requests"] else "(no user input)"
    summary = summary.replace("\n", " ").replace("|", "—").strip()[:120]

    icon = {"eligible": "✅", "partial": "⚠️", "non-eligible": "—"}.get(eligibility, "?")
    hours = duration / 60.0

    return (
        f"| {date_str} | {start_str}–{end_str} | {hours:.1f}h | {icon} | {summary} |",
        session,
    )


def generate_report(sessions, since_date=None):
    """Generate the full markdown time log."""
    if since_date:
        sessions = [s for s in sessions if s["first_timestamp"].date() >= since_date]

    sessions.sort(key=lambda s: s["first_timestamp"])

    by_date = defaultdict(list)
    for s in sessions:
        by_date[s["first_timestamp"].strftime("%Y-%m-%d")].append(s)

    total_hours = sum(s["duration_minutes"] for s in sessions) / 60.0
    eligible_hours = sum(
        s["duration_minutes"] for s in sessions
        if classify_sred_eligibility(s) == "eligible"
    ) / 60.0
    partial_hours = sum(
        s["duration_minutes"] for s in sessions
        if classify_sred_eligibility(s) == "partial"
    ) / 60.0

    lines = [
        "# SR&ED Time Log — Champollion Project",
        "",
        "> **Auto-generated from Antigravity conversation logs.**",
        "> CRA requires contemporaneous records of R&D work. This log is extracted from",
        "> actual development session timestamps and work descriptions.",
        ">",
        "> **Scope:** Only sessions touching Champollion / MT Eval Arena / crk-translate",
        "> project files or containing project-specific identifiers. Unrelated conversations",
        "> (other projects, job applications, general browsing) are excluded.",
        ">",
        "> **Eligibility classification is heuristic** — review and adjust before filing.",
        "> Sessions marked ✅ are likely eligible. ⚠️ = review needed. — = likely non-eligible.",
        "",
        "## Summary",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total Champollion sessions | {len(sessions)} |",
        f"| Total hours (project only) | {total_hours:.1f}h |",
        f"| Likely SR&ED eligible | {eligible_hours:.1f}h |",
        f"| Review needed | {partial_hours:.1f}h |",
        f"| Date range | {sessions[0]['first_timestamp'].strftime('%Y-%m-%d') if sessions else 'N/A'} → {sessions[-1]['first_timestamp'].strftime('%Y-%m-%d') if sessions else 'N/A'} |",
        "",
        "---",
        "",
        "## Session Log",
        "",
        "| Date | Time (UTC) | Duration | SR&ED | Work Summary |",
        "|------|-----------|----------|-------|--------------|",
    ]

    for session in sessions:
        row, _ = format_session_entry(session)
        lines.append(row)

    lines.extend([
        "",
        "---",
        "",
        "## Detailed Session Records",
        "",
    ])

    for date_str, day_sessions in sorted(by_date.items()):
        day_total = sum(s["duration_minutes"] for s in day_sessions) / 60.0
        lines.append(f"### {date_str} ({day_total:.1f}h total)")
        lines.append("")

        for s in day_sessions:
            elig = classify_sred_eligibility(s)
            icon = {"eligible": "✅", "partial": "⚠️", "non-eligible": "—"}.get(elig)
            lines.append(f"**Session** `{s['conversation_id'][:8]}...` — {s['duration_minutes']:.0f}min — {icon} {elig}")
            lines.append("")
            if s["user_requests"]:
                lines.append("Work performed:")
                for req in s["user_requests"][:5]:
                    req_clean = req.replace("\n", " ").strip()[:150]
                    lines.append(f"- {req_clean}")
            if s["files_modified"]:
                lines.append("")
                lines.append(f"Files touched ({len(s['files_modified'])}):")
                for fp in s["files_modified"][:10]:
                    lines.append(f"- `{fp}`")
                if len(s["files_modified"]) > 10:
                    lines.append(f"- ... and {len(s['files_modified']) - 10} more")
            lines.append("")

    lines.extend([
        "---",
        "",
        "## Notes for SR&ED Filing",
        "",
        "### What qualifies as SR&ED",
        "- Experimental development of MT evaluation metrics (FST acceptance rate, morphological scoring)",
        "- Research into evaluation methodologies for polysynthetic languages",
        "- Development of novel pipeline architectures (FST-as-hallucination-detector)",
        "- Prototype development of sovereignty-gated evaluation infrastructure",
        "- Corpus construction methodology research",
        "- Statistical significance testing methodology",
        "",
        "### What does NOT qualify",
        "- Routine website development, styling, documentation formatting",
        "- Marketing, outreach, grant writing",
        "- System administration, deployment, DevOps",
        "- Routine bug fixes with no technological uncertainty",
        "",
        "### API Costs (track separately)",
        "- Google AI (Gemini API) — check billing console",
        "- OpenRouter — check usage dashboard",
        "- Antigravity subscription — check billing",
        "",
        f"*Generated: {datetime.now(tz=timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}*",
    ])

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Extract Champollion SR&ED time data from Antigravity logs")
    parser.add_argument("--since", type=str, help="Only include sessions since this date (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true", help="Print to stdout instead of writing")
    parser.add_argument("--verbose", action="store_true",
                        help="Print rejected session summaries to stderr")
    parser.add_argument("--min-duration", type=float, default=2.0,
                        help="Minimum session duration in minutes to include (default: 2)")
    args = parser.parse_args()

    since_date = None
    if args.since:
        since_date = datetime.strptime(args.since, "%Y-%m-%d").date()

    # Find all transcript files
    pattern = os.path.join(BRAIN_DIR, "*", ".system_generated", "logs", "transcript.jsonl")
    transcript_files = glob.glob(pattern)
    print(f"Found {len(transcript_files)} conversation logs", file=sys.stderr)

    # Parse all transcripts, then filter to Champollion-only
    all_sessions = []
    rejected = 0
    for tf in transcript_files:
        session = parse_transcript(tf)
        if session and session["duration_minutes"] >= args.min_duration:
            if is_champollion_session(session):
                all_sessions.append(session)
            else:
                rejected += 1
                if args.verbose:
                    summary = session["user_requests"][0][:80] if session["user_requests"] else "(no input)"
                    print(f"  SKIP {session['conversation_id'][:8]}... — {summary}", file=sys.stderr)

    print(f"Champollion sessions: {len(all_sessions)} (rejected {rejected} non-project)", file=sys.stderr)

    report = generate_report(all_sessions, since_date)

    if args.dry_run:
        print(report)
    else:
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"Written to {OUTPUT_FILE}", file=sys.stderr)


if __name__ == "__main__":
    main()
