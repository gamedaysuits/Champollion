#!/usr/bin/env bash
#
# deploy-prod.sh — the ONE production deploy lane for champollion.dev.
#
# Why this script exists: the repo ROOT carries a .vercel/ linked to the
# `champollion-preview` project, while cli/website/.vercel targets the real
# `champollion` project. The same two vercel commands, run from the wrong
# cwd, silently ship the wrong site. This script pins the cwd, verifies the
# linked project BY NAME before doing anything, and refuses otherwise.
#
# Founder gate: deploying is a founder act. This script performs the deploy
# when run — do not run it without the founder's explicit go-ahead.
set -euo pipefail

cd "$(dirname "$0")/.."   # pin cwd to cli/website regardless of caller

node -e '
  const p = require("./.vercel/project.json");
  if (p.projectName !== "champollion") {
    console.error(`REFUSING TO DEPLOY: .vercel targets project "${p.projectName}", not "champollion".`);
    console.error("You are probably in the wrong directory — the repo root is linked to champollion-preview.");
    process.exit(1);
  }
'

npx vercel build --prod
npx vercel deploy --prebuilt --prod --archive=tgz
