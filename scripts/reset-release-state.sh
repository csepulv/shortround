#!/bin/bash

# This script resets the repository to a clean state on the main branch.
# It's designed to be a recovery tool if the release script fails midway,
# leaving the repository in a conflicted or messy state.

set -e

echo "--- Release State Recovery ---"

# Ensure we are in the root of the git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "Error: This script must be run from the root of the repository."
    exit 1
fi

echo "Attempting to abort any in-progress merge or rebase..."
# Use || true to prevent the script from exiting if there's nothing to abort
git merge --abort || true
git rebase --abort || true

echo "Resetting the git index..."
git reset

echo "Discarding all local changes..."
git checkout .

echo "Removing all untracked files and directories..."
git clean -fd

echo "Switching to the 'main' branch..."
git checkout main

echo "Pulling latest changes from origin to ensure main is up-to-date..."
git pull origin main

echo ""
echo "Recovery complete. Your repository is now on the 'main' branch and in a clean state."
echo "You can now safely restart the release process."
echo "--------------------------" 