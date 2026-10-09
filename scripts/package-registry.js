import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const pkgPath = path.join(rootDir, "package.json");
const bakPath = path.join(rootDir, "package.json.bak");

const GITHUB_SCOPE = "@samuel-0228";
const GITHUB_PACKAGE_NAME = `${GITHUB_SCOPE}/bilt-toolkit`;
const GITHUB_REGISTRY = "https://npm.pkg.github.com";

const NPM_PACKAGE_NAME = "bilt-toolkit";
const NPM_REGISTRY = "https://registry.npmjs.org";

function readPackageJson() {
  return JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
}

function writePackageJson(data) {
  fs.writeFileSync(pkgPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function backupPackageJson() {
  if (!fs.existsSync(bakPath)) {
    fs.copyFileSync(pkgPath, bakPath);
  }
}

function configureGitHub() {
  backupPackageJson();
  const pkg = readPackageJson();
  pkg.name = GITHUB_PACKAGE_NAME;
  pkg.publishConfig = {
    registry: GITHUB_REGISTRY,
  };
  writePackageJson(pkg);
  console.log(`[package-registry] Configured for GitHub Packages: ${pkg.name} -> ${GITHUB_REGISTRY}`);
}

function configureNpm() {
  const pkg = readPackageJson();
  pkg.name = NPM_PACKAGE_NAME;
  pkg.publishConfig = {
    registry: NPM_REGISTRY,
    access: "public",
  };
  writePackageJson(pkg);
  console.log(`[package-registry] Configured for npm: ${pkg.name} -> ${NPM_REGISTRY}`);
}

function configureNpmScoped() {
  backupPackageJson();
  const pkg = readPackageJson();
  pkg.name = GITHUB_PACKAGE_NAME;
  pkg.publishConfig = {
    registry: NPM_REGISTRY,
    access: "public",
  };
  writePackageJson(pkg);
  console.log(`[package-registry] Configured for scoped npm: ${pkg.name} -> ${NPM_REGISTRY} (access: public)`);
}

function publishNpmScoped() {
  try {
    console.log("[package-registry] Publishing scoped package to npmjs.com...");
    configureNpmScoped();
    execSync("npm publish --@samuel-0228:registry=https://registry.npmjs.org --access public", { cwd: rootDir, stdio: "inherit" });
    console.log("[package-registry] Successfully published scoped package to npmjs.com!");
  } finally {
    restorePackageJson();
  }
}

function restorePackageJson() {
  if (fs.existsSync(bakPath)) {
    fs.copyFileSync(bakPath, pkgPath);
    fs.unlinkSync(bakPath);
    console.log("[package-registry] Restored original package.json from backup.");
  } else {
    const pkg = readPackageJson();
    pkg.name = GITHUB_PACKAGE_NAME;
    pkg.publishConfig = {
      registry: GITHUB_REGISTRY,
    };
    writePackageJson(pkg);
    console.log("[package-registry] Reset package.json to default GitHub Packages configuration.");
  }
}

function packAll() {
  try {
    console.log("[package-registry] Packing GitHub Package...");
    configureGitHub();
    execSync("npm pack", { cwd: rootDir, stdio: "inherit" });

    console.log("[package-registry] Packing npm Package...");
    configureNpm();
    execSync("npm pack", { cwd: rootDir, stdio: "inherit" });
  } finally {
    restorePackageJson();
  }
}

const command = process.argv[2];

switch (command) {
  case "github":
    configureGitHub();
    break;
  case "npm":
    configureNpm();
    break;
  case "npm-scoped":
    configureNpmScoped();
    break;
  case "publish-npm-scoped":
    publishNpmScoped();
    break;
  case "restore":
    restorePackageJson();
    break;
  case "pack-all":
    packAll();
    break;
  default:
    console.error(`Usage: node scripts/package-registry.js <github|npm|npm-scoped|publish-npm-scoped|restore|pack-all>`);
    process.exit(1);
}
