# Release Process for Bilt CLI

This document outlines the automated release process for the Bilt CLI. We use GitHub Actions to automate publishing to **GitHub Packages**, the **public npm registry**, and creating **GitHub Releases** with attached `.tgz` tarball assets.

---

## Dual-Publish Architecture

Bilt is configured for dual-registry distribution:

| Registry | Package Name | Registry URL | Authentication |
| :--- | :--- | :--- | :--- |
| **GitHub Packages** | `@samuel-0228/bilt-toolkit` | `https://npm.pkg.github.com` | `GITHUB_TOKEN` (automatic in CI) |
| **npm Registry** | `bilt-toolkit` | `https://registry.npmjs.org` | `NPM_TOKEN` (repository secret) |
| **GitHub Releases** | `*.tgz` binary tarballs | GitHub Repository Releases | `GITHUB_TOKEN` (automatic in CI) |

- **GitHub Packages requirement**: GitHub Packages strictly requires a scoped package name matching the repository owner (`@samuel-0228`).
- **npm Registry**: The package is published unscoped as `bilt-toolkit` for standard discoverability.
- **Release Assets**: Both `samuel-0228-bilt-toolkit-<version>.tgz` and `bilt-toolkit-<version>.tgz` are automatically uploaded as downloadable assets on each GitHub Release.

---

## How to Create a New Release

To publish a new version of the Bilt CLI, follow these steps:

1. **Update the version:** Use `npm version` to bump the version in `package.json` and create a git tag automatically:
   - For a patch release (bug fixes): `npm version patch`
   - For a minor release (new features): `npm version minor`
   - For a major release (breaking changes): `npm version major`

2. **Push the commit and tag:**
   ```bash
   git push
   git push --tags
   ```

3. **Automation takes over:** The GitHub Actions `Release` workflow triggers automatically on tags matching `v*` (or via manual `workflow_dispatch` in GitHub Actions).

---

## How the Release Workflow Operates

When the `release.yml` GitHub Actions workflow runs:

1. **Validation & Build**:
   - Checks out the repository with full commit history.
   - Installs dependencies (`npm ci`).
   - Runs linting (`npm run lint`), type checking (`npx tsc --noEmit`), and all test suites (`npm run test:all`).
   - Builds the production distribution (`npm run build`).
   - Verifies the git tag version matches `package.json`.
   - Confirms required distribution files exist (`README.md`, `LICENSE`, `bin/bilt.js`, `dist/cli.js`).

2. **GitHub Packages Release**:
   - Temporarily scopes `package.json` to `@samuel-0228/bilt-toolkit` with `publishConfig.registry = "https://npm.pkg.github.com"`.
   - Generates the GitHub Packages tarball (`npm pack` -> `samuel-0228-bilt-toolkit-<version>.tgz`).
   - Publishes to GitHub Packages using the automatic `GITHUB_TOKEN` with `packages: write` permissions.

3. **npm Registry Release**:
   - Prepares `package.json` for npm (`bilt-toolkit`).
   - Generates the npm tarball (`npm pack` -> `bilt-toolkit-<version>.tgz`).
   - If the `NPM_TOKEN` secret is configured, publishes to public npm with public access. If `NPM_TOKEN` is not set, this step is cleanly skipped without failing the workflow.

4. **Safety Restore**:
   - Guarantees `package.json` is restored to its clean, unmutated state.

5. **GitHub Release & Assets**:
   - Creates or updates the GitHub Release with auto-generated release notes.
   - Attaches both `.tgz` packages (`samuel-0228-bilt-toolkit-*.tgz` and `bilt-toolkit-*.tgz`) directly to the release.

---

## Installing from GitHub Packages (For Consumers)

To install or test Bilt from GitHub Packages:

1. **Configure npm to route the scope:**
   Create or update `.npmrc` in your project root or home directory (see [`.npmrc.example`](.npmrc.example)):
   ```ini
   @samuel-0228:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
   ```
   *(A GitHub Personal Access Token with `read:packages` permission is required for private repositories, or standard access for public).*

2. **Install the package:**
   ```bash
   npm install -D @samuel-0228/bilt-toolkit
   ```

3. **Run the CLI:**
   ```bash
   npx @samuel-0228/bilt-toolkit --version
   # Or directly if installed globally:
   bilt --version
   ```

---

## Local Packaging Commands

You can test packaging locally without publishing:

```bash
# Prepare package.json for GitHub Packages:
npm run pkg:github

# Prepare package.json for npm:
npm run pkg:npm

# Restore package.json to original state:
npm run pkg:restore

# Pack both tarballs and verify packaging cleanly:
npm run pack:all
```

---

## Required GitHub Permissions & Secrets

- **GitHub Packages**: Uses the built-in `GITHUB_TOKEN` provided by GitHub Actions. Requires `packages: write` and `contents: write` permissions (already declared in `.github/workflows/release.yml`). No manual token setup needed!
- **npm Registry (Optional for dual-publish)**:
  - Secret name: `NPM_TOKEN`
  - Granular access token or automation token created on [npmjs.com](https://www.npmjs.com/).
  - Configured in GitHub repo under **Settings** -> **Secrets and variables** -> **Actions**.

---

## How to Recover from a Failed Release

1. **Check the logs:** Inspect the failed `Release` workflow run in the **Actions** tab.
2. **Fix the issue:** Commit fixes to `main`.
3. **If neither registry published:** Delete the tag and recreate:
   ```bash
   git tag -d v1.2.3
   git push origin :refs/tags/v1.2.3
   ```
4. **If a registry already published:** Neither npm nor GitHub Packages allows re-publishing the identical version number. Bump the patch version (`npm version patch`) and push the new tag.
