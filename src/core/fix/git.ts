import { simpleGit } from "simple-git";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

const execAsync = promisify(exec);

export interface AffectedCommit {
  hash: string;
  timestamp: number;
  message: string;
}

export interface GitSafetySnapshot {
  id: string;
  branch: string;
  tag: string;
  head: string;
  createdAt: string;
}

export interface SecretRemediationPlan {
  secretPreview: string;
  introducingCommit?: string;
  affectedCommits: AffectedCommit[];
  forcePushRequired: boolean;
  hasRemote: boolean;
  estimatedSteps: string[];
}

export interface SecretVerificationResult {
  verified: boolean;
  historyHits: number;
  workingTreeHit: boolean;
  message: string;
}

export interface SecretRemediationExecution {
  success: boolean;
  snapshot?: GitSafetySnapshot;
  verification: SecretVerificationResult;
  warnings: string[];
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return "*".repeat(secret.length);
  return `${secret.slice(0, 4)}${"*".repeat(Math.min(16, secret.length - 8))}${secret.slice(-4)}`;
}

async function ensureGitRepo(rootDir: string): Promise<void> {
  const git = simpleGit(rootDir);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error("This project is not a Git repository.");
  }
}

async function ensureCleanWorkingTree(rootDir: string): Promise<void> {
  const git = simpleGit(rootDir);
  const status = await git.status();
  if (!status.isClean()) {
    throw new Error("Uncommitted changes detected. Commit or stash changes before history remediation.");
  }
}

function parseAffectedCommits(raw: string): AffectedCommit[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash = "", ts = "0", ...msgParts] = line.split("\t");
      return {
        hash,
        timestamp: Number(ts) || 0,
        message: msgParts.join("\t") || "",
      };
    })
    .filter((c) => c.hash.length > 0);
}

export async function locateIntroducingCommit(rootDir: string, secretValue: string): Promise<string | undefined> {
  await ensureGitRepo(rootDir);
  const git = simpleGit(rootDir);

  const raw = await git.raw([
    "log",
    "--all",
    "--reverse",
    "--format=%H",
    "-S",
    secretValue,
    "--",
  ]);

  const first = raw
    .split("\n")
    .map((v) => v.trim())
    .find(Boolean);

  return first || undefined;
}

export async function findAffectedCommits(rootDir: string, secretValue: string): Promise<AffectedCommit[]> {
  await ensureGitRepo(rootDir);
  const git = simpleGit(rootDir);

  const raw = await git.raw([
    "log",
    "--all",
    "--format=%H%x09%ct%x09%s",
    "-S",
    secretValue,
    "--",
  ]);

  return parseAffectedCommits(raw);
}

export async function createGitSafetySnapshot(rootDir: string): Promise<GitSafetySnapshot> {
  await ensureGitRepo(rootDir);
  const git = simpleGit(rootDir);

  const head = (await git.revparse(["HEAD"])).trim();
  const id = `${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}-${Math.random().toString(16).slice(2, 8)}`;
  const branch = `bilt/snapshot/${id}`;
  const tag = `bilt-snapshot-${id}`;

  await git.raw(["branch", branch, head]);
  await git.raw(["tag", tag, head]);

  return {
    id,
    branch,
    tag,
    head,
    createdAt: new Date().toISOString(),
  };
}

export async function previewSecretRemediation(
  rootDir: string,
  secretValue: string,
): Promise<SecretRemediationPlan> {
  if (!secretValue || secretValue.length < 5) {
    throw new Error("Secret value is too short for safe history remediation.");
  }

  await ensureGitRepo(rootDir);

  const [introducingCommit, affectedCommits, remotesRaw] = await Promise.all([
    locateIntroducingCommit(rootDir, secretValue),
    findAffectedCommits(rootDir, secretValue),
    simpleGit(rootDir).raw(["remote"]),
  ]);

  const hasRemote = remotesRaw
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean).length > 0;

  return {
    secretPreview: maskSecret(secretValue),
    introducingCommit,
    affectedCommits,
    forcePushRequired: affectedCommits.length > 0 && hasRemote,
    hasRemote,
    estimatedSteps: [
      "Create safety snapshot (branch + tag)",
      "Rewrite history locally to redact the secret",
      "Verify secret removal from history and current HEAD",
      hasRemote ? "Force-push rewritten refs to remote" : "No remote detected, no push needed",
    ],
  };
}

async function runHistoryRewrite(rootDir: string, secretValue: string): Promise<void> {
  const secretB64 = Buffer.from(secretValue).toString("base64");
  const script = `
const fs = require('fs');
const path = require('path');
const secret = Buffer.from('${secretB64}', 'base64').toString('utf8');
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (f === '.git') continue;
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else {
      try {
        const c = fs.readFileSync(p, 'utf8');
        if (c.includes(secret)) {
          fs.writeFileSync(p, c.split(secret).join('[REDACTED_BY_BILT]'));
        }
      } catch {}
    }
  }
}
walk('.');
`;

  const tmpFile = path.join(os.tmpdir(), `bilt-rewrite-${Date.now()}.js`);
  await fs.writeFile(tmpFile, script, "utf8");

  try {
    const scriptPath = tmpFile.replace(/\\/g, "/");
    const cmd = `git filter-branch --force --tree-filter "node \\\"${scriptPath}\\\"" --tag-name-filter cat -- --all`;
    await execAsync(cmd, { cwd: rootDir });

    const git = simpleGit(rootDir);
    const refsRaw = await git.raw(["for-each-ref", "--format=%(refname)", "refs/original/"]);
    const refs = refsRaw.split("\n").map((v) => v.trim()).filter(Boolean);
    for (const ref of refs) {
      await git.raw(["update-ref", "-d", ref]).catch(() => undefined);
    }

    await git.raw(["reflog", "expire", "--expire=now", "--all"]).catch(() => undefined);
    await git.raw(["gc", "--prune=now", "--aggressive"]).catch(() => undefined);
  } finally {
    await fs.unlink(tmpFile).catch(() => undefined);
  }
}

export async function verifySecretRemoval(
  rootDir: string,
  secretValue: string,
): Promise<SecretVerificationResult> {
  await ensureGitRepo(rootDir);
  const git = simpleGit(rootDir);

  const historyRaw = await git.raw([
    "log",
    "--all",
    "--format=%H",
    "-S",
    secretValue,
    "--",
  ]);

  const historyHits = historyRaw
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean).length;

  let workingTreeHit = false;
  try {
    const grepRaw = await git.raw(["grep", "-n", "--fixed-strings", secretValue, "HEAD"]);
    workingTreeHit = grepRaw.trim().length > 0;
  } catch {
    workingTreeHit = false;
  }

  if (historyHits === 0 && !workingTreeHit) {
    return {
      verified: true,
      historyHits,
      workingTreeHit,
      message: "Verified: secret was removed from Git history and current HEAD.",
    };
  }

  return {
    verified: false,
    historyHits,
    workingTreeHit,
    message: "Verification failed: secret still appears in history or current HEAD.",
  };
}

export async function executeSecretRemediation(
  rootDir: string,
  secretValue: string,
): Promise<SecretRemediationExecution> {
  if (!secretValue || secretValue.length < 5) {
    throw new Error("Secret value is too short to safely purge from history.");
  }

  await ensureGitRepo(rootDir);
  await ensureCleanWorkingTree(rootDir);

  const plan = await previewSecretRemediation(rootDir, secretValue);
  const warnings: string[] = [];

  if (plan.affectedCommits.length === 0) {
    const verification = await verifySecretRemoval(rootDir, secretValue);
    return {
      success: verification.verified,
      verification,
      warnings: ["No affected commits were found in current refs."],
    };
  }

  const snapshot = await createGitSafetySnapshot(rootDir);
  await runHistoryRewrite(rootDir, secretValue);

  const verification = await verifySecretRemoval(rootDir, secretValue);
  if (plan.forcePushRequired) {
    warnings.push("History was rewritten locally. A force-push will be required for remote branches.");
  }

  return {
    success: verification.verified,
    snapshot,
    verification,
    warnings,
  };
}

export async function restoreGitSnapshot(rootDir: string, snapshotRef: string): Promise<void> {
  await ensureGitRepo(rootDir);
  const git = simpleGit(rootDir);
  await git.raw(["reset", "--hard", snapshotRef]);
}

// Backward-compatible wrapper used in existing tests and callers.
export async function purgeSecretFromHistory(rootDir: string, secretValue: string): Promise<boolean> {
  const execution = await executeSecretRemediation(rootDir, secretValue);
  return execution.success;
}
