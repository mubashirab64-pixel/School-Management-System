#!/bin/bash
# deploy.sh — run this on the server to deploy a new version
# Usage: ./deploy.sh [version]
# Example: ./deploy.sh 3.3.6
# If version is omitted, reads from backend/VERSION

set -e

# ── 1. Determine version ─────────────────────────────────────────────────────
if [ -n "$1" ]; then
    NEW_VERSION="$1"
    echo "$NEW_VERSION" > backend/VERSION
    echo "[deploy] Version set to $NEW_VERSION"
else
    NEW_VERSION=$(cat backend/VERSION 2>/dev/null | tr -d '[:space:]')
    echo "[deploy] Using existing version: $NEW_VERSION"
fi

# ── 2. Auto-generate RELEASE_NOTES.txt from git log ─────────────────────────
LAST_TAG=$(git tag --sort=-creatordate | head -n 1)
NOTES_FILE="backend/RELEASE_NOTES.txt"

if [ -n "$LAST_TAG" ]; then
    echo "[deploy] Getting commits since tag: $LAST_TAG"
    git log "${LAST_TAG}..HEAD" --pretty=format:"• %s" --no-merges > "$NOTES_FILE"
else
    echo "[deploy] No tags found — using last 10 commits"
    git log -10 --pretty=format:"• %s" --no-merges > "$NOTES_FILE"
fi

echo ""
echo "[deploy] Release notes:"
cat "$NOTES_FILE"
echo ""

# ── 3. Tag this release in git ───────────────────────────────────────────────
TAG_NAME="v$NEW_VERSION"
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    echo "[deploy] Tag $TAG_NAME already exists — skipping tag creation"
else
    git tag "$TAG_NAME"
    echo "[deploy] Created git tag: $TAG_NAME"
fi

# ── 4. Deploy ────────────────────────────────────────────────────────────────
echo "[deploy] Starting docker-compose..."
docker-compose up --build -d

echo ""
echo "[deploy] Done! Deployed $TAG_NAME"
