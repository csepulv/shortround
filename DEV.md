# Release Process

This document outlines the steps to create a new public release.

The process is designed to publish clean, squashed commits to the public repository while maintaining a detailed development history in the private repository.

## Pre-requisites

- All development work for the release is complete and merged into the `main` branch.
- You have the `public` remote configured to point to your public GitHub repository.

## Step-by-Step Instructions

1.  **Create Changesets:**
    As you work on features, fixes, or breaking changes, add changeset files. This is typically done on your feature branches before merging to `main`.
    ```bash
    pnpm changeset add
    ```

2.  **Bump Versions:**
    Once all changes for the release are on `main`, run the `changeset version` command. This will consume all pending changeset files, update the version numbers in the `package.json` files of the affected packages, and generate/update `CHANGELOG.md` files.
    ```bash
    pnpm changeset version
    ```

3.  **Commit Version Files:**
    Commit the changes made by the versioning command. This includes the updated `package.json` and `CHANGELOG.md` files.
    ```bash
    git add . 
    git commit -m "chore: Version packages for release"
    ```

4.  **Create Release Tags:**
    Run the `changeset tag` command. This will create git tags for each package that was versioned in the previous step (e.g., `my-package@1.2.3`).
    ```bash
    pnpm changeset tag
    ```

5.  **Run the Release Script:**
    Execute the automated release script. This script will create the clean, squashed commit on the `latest` branch and prepare the tags for pushing.
    ```bash
    pnpm run release
    ```

6.  **Push to Remotes:**
    The release script will finish by printing the `git push` commands required to publish the release. Review them and then run them manually.

    **Push to Public Repo:**
    ```bash
    # Example commands printed by the script:
    git push public latest
    git push public --tags --force
    ```

    **Update Tags on Private Repo:**
    It's important to also force-push the tags to your private `origin` remote so they point to the new public-facing release commits.
    ```bash
    # Example command printed by the script:
    git push origin --tags --force
    git push origin latest
    ```

7.  **Publish to npm (Optional):**
    If you use `changesets` to publish to npm, you can do so now.
    ```bash
    pnpm changeset publish
    ```

# Local Development Hot-Reloading

To enable automatic hot-reloading of your `shortround` components in a local test application (e.g., `my-test-app`), follow these steps.

This setup uses `turbo` to watch and rebuild your packages, and `chokidar-cli` to automatically push the built packages to your local `yalc` store.

## Prerequisites

1.  **`yalc` Installed Globally:** If you haven't already, install `yalc` globally:
    ```bash
    npm install -g yalc
    ```

2.  **Initial Build:** Ensure you have performed an initial build of your `shortround` packages:
    ```bash
    pnpm run build
    ```

3.  **Test Application Setup:**
    *   Create a separate test application (e.g., a new Vite React app).
    *   Navigate into your test application's directory.
    *   Add your `shortround` packages to the test application using `yalc`:
        ```bash
        yalc add @shortround/core
        yalc add @shortround/mui
        yalc add @shortround/shadcn-ui
        # Add any other shortround packages you are testing
        ```
    *   Install any necessary peer dependencies in your test application (e.g., `react`, `@mui/material`).

## Running Hot-Reload

To enable hot-reloading, you need to run two commands concurrently in separate terminal windows from the root of your `shortround` project:

### Terminal 1: Build Watcher

This command uses `turbo` to watch your source files and rebuild your packages whenever changes are detected. `turbo` will intelligently rebuild only the affected packages.

```bash
pnpm run dev:watch
```

### Terminal 2: Yalc Publisher

This command uses `chokidar-cli` to watch the `dist` folders of your packages. Once `dev:watch` rebuilds a package and updates its `dist` folder, this command will automatically push the updated package to your local `yalc` store.

```bash
pnpm run dev:yalc
```

## How it Works

*   When you save a change in your `shortround` source code, `pnpm run dev:watch` (via `turbo`) detects it and rebuilds the affected package(s), updating their `dist` folders.
*   `pnpm run dev:yalc` (via `chokidar-cli`) detects the changes in the `dist` folders.
*   It then triggers `yalc publish --push --no-scripts` for the specific package that changed.
*   `yalc` pushes the updated package to its local store, and automatically updates any consumer projects (like `my-test-app`) that have `yalc add`ed that package.
*   Your test application's development server (e.g., Vite's dev server) detects the change in `node_modules` and hot-reloads, reflecting your latest changes.

This decoupled approach ensures that only fully built and up-to-date packages are pushed to `yalc`, providing a robust and efficient hot-reloading experience.
