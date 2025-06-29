#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
MAIN_BRANCH="main"
RELEASE_BRANCH="latest"
PUBLIC_REMOTE="public"
PRIVATE_REMOTE="origin"

# --- Pre-flight Checks ---
echo "Running pre-flight checks..."

# Check if the working directory is clean
if ! git diff-index --quiet HEAD --; then
    echo "Error: Working directory is not clean. Please commit or stash your changes."
    exit 1
fi

# Check if we are on the main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "$MAIN_BRANCH" ]]; then
    echo "Error: This script must be run from the '$MAIN_BRANCH' branch, but you are on '$CURRENT_BRANCH'."
    exit 1
fi

echo "Pre-flight checks passed."

# --- Get Release Info ---
echo "Gathering release information..."

# Get the latest tags from the current commit on the main branch.
# This assumes `pnpm changeset tag` was just run.
RELEASE_TAGS=$(git tag --points-at HEAD)

if [ -z "$RELEASE_TAGS" ]; then
    echo "Error: No release tags found at the HEAD of '$MAIN_BRANCH'."
    echo "Please run 'pnpm changeset version' and 'pnpm changeset tag' first."
    exit 1
fi

echo "Found release tags:"
echo "$RELEASE_TAGS"

# Create a release commit message from the tags
COMMIT_MESSAGE=$(echo -e "feat: Release\n\n$(echo "$RELEASE_TAGS" | sed 's/^/- /')")

# --- Perform Release ---
echo "Switching to the '$RELEASE_BRANCH' branch..."
git checkout "$RELEASE_BRANCH"

echo "Merging changes from '$MAIN_BRANCH'...
"
git merge --squash "$MAIN_BRANCH"

echo "Excluding release guide from public commit..."
git rm --cached RELEASES.md
git rm --cached -r .changeset

echo "Committing squashed changes..."
git commit -m "$COMMIT_MESSAGE"

echo "Updating tags..."
for TAG in $RELEASE_TAGS; do
    echo "Moving tag '$TAG' to the new release commit."
    git tag -f "$TAG"
done

echo "Release commit created and tags updated locally."

# --- Push to Remotes (Instructional) ---
echo ""
echo "--- ACTION REQUIRED ---"
echo "The script has finished the local part of the release."
echo "Please review the changes and then push them manually when ready."
echo ""
echo "To push the release to the PUBLIC repository, run:"
echo "  git push $PUBLIC_REMOTE $RELEASE_BRANCH"
echo "  git push $PUBLIC_REMOTE --tags --force"
echo ""
echo "To update the tags on your PRIVATE repository, run:"
echo "  git push $PRIVATE_REMOTE --tags --force"
echo "-----------------------"


# --- Cleanup ---
echo ""
echo "Switching back to the '$MAIN_BRANCH' branch."
git checkout "$MAIN_BRANCH"

echo "Release process complete."
