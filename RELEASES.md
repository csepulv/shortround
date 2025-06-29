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
    ```

7.  **Publish to npm (Optional):**
    If you use `changesets` to publish to npm, you can do so now.
    ```bash
    pnpm changeset publish
    ```
