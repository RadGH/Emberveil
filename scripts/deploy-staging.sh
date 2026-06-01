#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN_FILE="${EMBERVEIL_STAGING_TOKEN_FILE:-${EMBERVEIL_GITHUB_TOKEN_FILE:-/home/radgh/codex/secrets/emberveil-github-access-token.txt}}"
REPO_URL="${EMBERVEIL_STAGING_REPO_URL:-https://github.com/RadGH/Emberveil.git}"
BRANCH="${EMBERVEIL_STAGING_BRANCH:-staging}"
BASE_URL="${EMBERVEIL_STAGING_BASE_URL:-${VITE_BASE:-./}}"
AUTHOR_NAME="${GIT_AUTHOR_NAME:-Claude Code}"
AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-2008464+RadGH@users.noreply.github.com}"

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "Missing token file: $TOKEN_FILE" >&2
  exit 1
fi

WORKDIR="$(mktemp -d)"
cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

"$ROOT/scripts/build-staging-pages.sh"

TOKEN="$(<"$TOKEN_FILE")"
CLONE_URL="${REPO_URL/https:\/\//https:\/\/x-access-token:${TOKEN}@}"
git clone --quiet --depth 1 --filter=blob:none --branch "$BRANCH" --single-branch "$CLONE_URL" "$WORKDIR/repo"

rsync -a --delete --exclude '.git' "$ROOT/dist/" "$WORKDIR/repo/"

if [[ ! -f "$WORKDIR/repo/.nojekyll" && -f "$ROOT/public/.nojekyll" ]]; then
  cp "$ROOT/public/.nojekyll" "$WORKDIR/repo/.nojekyll"
fi

cd "$WORKDIR/repo"
git config user.name "$AUTHOR_NAME"
git config user.email "$AUTHOR_EMAIL"
git add -A

if git diff --cached --quiet; then
  echo "No deploy changes to push."
  exit 0
fi

git commit -m "Deploy Emberveil staging site" \
  --author="$AUTHOR_NAME <$AUTHOR_EMAIL>"
git push origin "$BRANCH"

echo "Pushed $BRANCH from $REPO_URL with base $BASE_URL"
