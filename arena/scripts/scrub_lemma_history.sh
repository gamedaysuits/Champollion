#!/usr/bin/env bash
# scrub_lemma_history.sh — remove the Wolvengrey/itwêwina lemma blobs from
# the monorepo's ENTIRE git history, so the history itself is clean and no
# future mirror/subtree operation can ever re-leak them.
#
# WHAT IT REMOVES (every historical version, all branches):
#   arena/mt_eval_harness/eval_standards/crk/data/lemmas.json
#   crk-translate/crk_translate/dictionary/lemmas.json
#   crk_translate/dictionary/lemmas.json     (unprefixed path from the
#                                             original crk-translate history
#                                             imported at subtree-add time)
# The on-disk files are untouched (they are gitignored, operator-local).
#
# BLAST RADIUS: the crk-translate copy has been tracked since early monorepo
# history, so virtually EVERY commit SHA changes. That is fine for a
# single-maintainer private repo, but it means:
#   - one-time force-push of all branches + tags to origin (printed at end)
#   - every other clone/worktree must be re-cloned or hard-reset
#   - SHAs quoted in docs/handoffs/memory become historical references
#
# SAFETY RAILS (the script refuses to run unless):
#   - working tree is COMPLETELY clean (no other agent session mid-edit)
#   - exactly one git worktree exists
#   - a full backup bundle is written first (~/Champollion-backups/)
#
# Usage:  arena/scripts/scrub_lemma_history.sh        # runs locally only
# After:  follow the printed force-push + mirror steps (founder).

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

PATHS=(
  "arena/mt_eval_harness/eval_standards/crk/data/lemmas.json"
  "crk-translate/crk_translate/dictionary/lemmas.json"
  "crk_translate/dictionary/lemmas.json"
)

# ── Guards ────────────────────────────────────────────────────────────
if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree is not clean — another session may be mid-edit." >&2
  echo "       Re-run when 'git status' is empty." >&2
  exit 1
fi
if [[ "$(git worktree list | wc -l | tr -d ' ')" != "1" ]]; then
  echo "error: extra git worktrees exist — remove them first (git worktree list)." >&2
  exit 1
fi
if ls .git/*.lock >/dev/null 2>&1; then
  echo "error: .git lock present — another git process is running." >&2
  exit 1
fi

# ── Backup ────────────────────────────────────────────────────────────
BACKUP_DIR="$HOME/Champollion-backups"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
BUNDLE="$BACKUP_DIR/champollion-pre-scrub-$STAMP.bundle"
echo "Writing full backup bundle (all refs) -> $BUNDLE"
git bundle create "$BUNDLE" --all
git remote -v > "$BACKUP_DIR/remotes-$STAMP.txt"
PRE_TREE="$(git rev-parse 'HEAD^{tree}')"
PRE_HEAD="$(git rev-parse HEAD)"

# ── Get git-filter-repo ───────────────────────────────────────────────
FILTER_REPO="$(command -v git-filter-repo || true)"
if [[ -z "$FILTER_REPO" ]]; then
  FILTER_REPO="/tmp/git-filter-repo-$STAMP.py"
  echo "Fetching git-filter-repo (single-file official script)…"
  curl -fsSL -o "$FILTER_REPO" \
    "https://raw.githubusercontent.com/newren/git-filter-repo/v2.45.0/git-filter-repo"
  chmod +x "$FILTER_REPO"
  FILTER_REPO="python3 $FILTER_REPO"
fi

# ── Rewrite ───────────────────────────────────────────────────────────
ARGS=()
for p in "${PATHS[@]}"; do ARGS+=(--path "$p"); done
echo "Rewriting history (this removes the paths above from every commit)…"
$FILTER_REPO --force --invert-paths "${ARGS[@]}"

# ── Verify ────────────────────────────────────────────────────────────
POST_TREE="$(git rev-parse 'HEAD^{tree}')"
if [[ "$POST_TREE" != "$PRE_TREE" ]]; then
  echo "FATAL: HEAD tree changed ($PRE_TREE -> $POST_TREE)." >&2
  echo "       The current files should be IDENTICAL (paths were already" >&2
  echo "       deleted at HEAD). Restore from $BUNDLE and investigate." >&2
  exit 1
fi
for p in "${PATHS[@]}"; do
  if [[ -n "$(git log --all --oneline -- "$p" | head -1)" ]]; then
    echo "FATAL: $p still appears in history. Restore from $BUNDLE." >&2
    exit 1
  fi
done
echo "Verified: HEAD tree unchanged; lemma paths gone from all history."

# ── Restore remotes (filter-repo strips origin by design) ────────────
while read -r name url _; do
  git remote add "$name" "$url" 2>/dev/null || true
done < <(awk '/\(fetch\)/{print $1, $2}' "$BACKUP_DIR/remotes-$STAMP.txt")
echo "Remotes restored:"; git remote -v | awk '/\(push\)/{print "  " $1 " " $2}'

# ── Next steps (founder) ──────────────────────────────────────────────
cat <<EOF

DONE LOCALLY. Old HEAD $PRE_HEAD -> new $(git rev-parse HEAD).
Backup bundle: $BUNDLE  (restore: git clone $BUNDLE)

Founder steps to finish:
  1. git push --force --all origin && git push --force --tags origin
  2. Re-clone or hard-reset any other checkout of this repo.
  3. Mirrors: the public harness mirror keeps its clean root (CI snapshot
     workflow keeps it fresh — no action). The PRIVATE crk mirror
     (github.com/gamedaysuits/crk-translate) still holds lemma blobs in
     its own history — delete & re-push it, or leave private until the
     ALTLab licensing conversation resolves.
  4. Optional: ask GitHub support to run GC on gds-mt-eval-harness so the
     pre-purge blob SHA stops being fetchable.
EOF
