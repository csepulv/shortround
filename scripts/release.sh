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

# Create a release commit message from the last commit on the main branch.
COMMIT_MESSAGE=$(git log -1 --pretty=%B "$MAIN_BRANCH")

# --- Perform Release ---
echo "Switching to the '$RELEASE_BRANCH' branch..."
git checkout "$RELEASE_BRANCH"

# --- Robust Squash Commit Strategy ---
# The standard `git merge --squash` can fail if the branches have diverged
# significantly with unrelated histories, causing conflicts on files like .gitignore.
# This method avoids a merge altogether by resetting the branch state, which is more reliable.

echo "Creating a squashed commit from '$MAIN_BRANCH'..."

# 1. Store the original commit of the release branch before we modify it.
ORIGINAL_RELEASE_COMMIT=$(git rev-parse HEAD)

# 2. Temporarily hard reset to the main branch. This brings all the files and commit history from main
#    into the release branch, overwriting its current state.
git reset --hard "$MAIN_BRANCH"

# 3. Soft reset back to the original release commit.
#    - This moves the branch pointer (HEAD) back to where it was.
#    - Crucially, `--soft` leaves all the file changes from the main branch in the staging area (index).
#    - The result is identical to a successful `git merge --squash`, with all changes staged for a single commit.
git reset --soft "$ORIGINAL_RELEASE_COMMIT"

# The script can now proceed to the next steps. All changes from main are staged and ready to be filtered and committed.

echo "Excluding files listed in .publicignore from public commit..."
# Always exclude the .publicignore file itself
git rm --cached .publicignore || true

if [ -f ".publicignore" ]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        [[ -z "$line" || "${line:0:1}" == "#" ]] && continue
        echo "Excluding: $line"
        git rm --cached -r "$line" || true # Use || true to prevent script from exiting if file is not found
    done < .publicignore
else
    echo "Warning: .publicignore file not found. No files will be excluded based on it."
fi

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
echo "Cleaning up excluded files before switching branches..."
git clean -fd

echo "Switching back to the '$MAIN_BRANCH' branch."
git checkout "$MAIN_BRANCH"

echo "Release process complete."
