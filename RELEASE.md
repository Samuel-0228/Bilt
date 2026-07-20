# Release Process for Bilt CLI

This document outlines the automated release process for the Bilt CLI. We use GitHub Actions to automate publishing to npm and creating GitHub Releases.

## How to Create a New Release

To publish a new version of the Bilt CLI, follow these steps:

1. **Update the version:** Use `npm version` to bump the version in `package.json` and create a git tag automatically.
   - For a patch release (bug fixes): `npm version patch`
   - For a minor release (new features): `npm version minor`
   - For a major release (breaking changes): `npm version major`

2. **Push the changes and the tag:**
   ```bash
   git push
   git push --tags
   ```

3. **Automation takes over:** The GitHub Actions `Release` workflow will trigger automatically because a new tag matching `v*` was pushed. Normal commits or pull requests will **never** trigger a publish.

## How npm Publishing Works

1. The `release.yml` GitHub Actions workflow listens for tag pushes (e.g., `v1.0.0`).
2. It checks out the code, installs dependencies, lints, typechecks, tests, and builds the project.
3. The workflow validates that:
   - The git tag matches the `package.json` version.
   - Essential files (`README.md`, `LICENSE`, `bin/bilt.js`) are present.
4. It performs a dry run (`npm pack --dry-run`).
5. Finally, it publishes the package to npm using the configured `NPM_TOKEN`.
6. It automatically creates a GitHub Release with release notes generated from the commits since the last tag.

## Semantic Versioning (Major / Minor / Patch)

We follow [Semantic Versioning (SemVer)](https://semver.org/):

- **Major (X.y.z):** Incompatible API or CLI breaking changes.
- **Minor (x.Y.z):** New functionality added in a backwards-compatible manner.
- **Patch (x.y.Z):** Backwards-compatible bug fixes.

## Required GitHub Secrets

The release workflow requires the following secret to be configured in the GitHub repository (`Settings` -> `Secrets and variables` -> `Actions`):

- `NPM_TOKEN`: A granular npm access token with publish permissions for the package.

**Note:** The npm token is securely passed to the Node process and never logged or exposed in the workflow outputs.

## How to Rotate the npm Token

If the npm token is compromised or needs to be rotated:

1. Log in to [npmjs.com](https://www.npmjs.com/).
2. Go to **Access Tokens** under your account profile.
3. Generate a new **Granular Access Token** (or Automation Token) with permissions to publish this package.
4. Delete the old token.
5. Go to the GitHub repository **Settings** -> **Secrets and variables** -> **Actions**.
6. Update the `NPM_TOKEN` repository secret with the new token value.

## How to Recover from a Failed Release

If the GitHub Action fails during the release process:

1. **Check the logs:** Go to the **Actions** tab in GitHub and inspect the failed `Release` workflow run to identify the issue (e.g., failed tests, missing files, or authentication error).
2. **Fix the code:** Make the necessary corrections on the `main` branch.
3. **Delete the tag (if necessary):** If the package *was not* published to npm yet, you can delete the local and remote git tag to retry:
   ```bash
   git tag -d v1.2.3
   git push origin :refs/tags/v1.2.3
   ```
4. **Retry the release:** Once fixed, create the tag again and push.
   - *Note:* npm does not allow overwriting or republishing the exact same version number. If `npm publish` succeeded but the GitHub Release failed, you must bump the version (e.g., `npm version patch`) for the next attempt.
