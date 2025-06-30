# Project Status Summary for New Session

This document summarizes the current state of your project and the ongoing task, allowing for a seamless continuation in a new chat session.

## 1. Overall Goal

To establish a robust dual-repository release workflow for your NPM monorepo. This involves:
- Maintaining a private GitHub repository (`origin`) with full commit history.
- Maintaining a public GitHub repository (`public`) with a clean, squashed history of only release versions.
- Automating the release process using `changesets` and custom scripts.
- Setting up local testing with `yalc` and hot-reloading capabilities.

## 2. Current Setup & Configuration

- **Git Remotes:**
  - `origin`: Your private GitHub repository.
  - `public`: Your public GitHub repository (`https://github.com/csepulv/shortround.git`).
- **Release Branch:**
  - `latest`: A dedicated branch for public releases. It's intended to have a linear, squashed history.
- **Versioning & Release Tooling:**
  - `changesets` is installed and configured (`.changeset/config.json`).
  - `access: public` is set in `.changeset/config.json`.
  - `@shortround/shadcnui` is added to the `ignore` array in `.changeset/config.json` to prevent its publishing.
  - `package.json` files for `@shortround/core` and `@shortround/mui` have been updated with public repository metadata (description, keywords, author, license, repository, bugs, homepage).
- **Release Script:**
  - `scripts/release.sh` exists and is executable.
  - It handles switching to `latest`, squashing `main`'s changes, and moving tags.
  - It includes logic to exclude `DEV.md` and `.changeset/` from the public release.
  - **Current State:** The script was recently updated to include `--allow-unrelated-histories` for the `git merge` command, which is crucial for the *first* merge into an orphan branch.
- **Documentation:**
  - `RELEASES.md`: Contains step-by-step instructions for the release process.
  - `DEV.md`: Contains instructions for local development hot-reloading.
- **Local Testing:**
  - `yalc` is the recommended tool for local package testing.
  - `chokidar-cli` is installed for watching `dist` folders and triggering `yalc publish` for hot-reloading.
  - `package.json` includes `dev:watch` (using `turbo watch`) and `dev:yalc` (using `chokidar-cli`) scripts.

## 3. Last Attempted Action & Outcome

- **Action:** Attempted to run `pnpm run release` to perform the first public release.
- **Outcome:** The script failed 
