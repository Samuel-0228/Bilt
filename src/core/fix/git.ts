import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

const execAsync = promisify(exec);

/**
 * Surgically removes a string from Git history using git filter-branch.
 * Note: This replaces the exact string with [REDACTED_BY_BILT] across all commits in all files.
 */
export async function purgeSecretFromHistory(rootDir: string, secretValue: string): Promise<boolean> {
  if (!secretValue || secretValue.length < 5) {
    throw new Error("Secret value is too short to safely purge from history (risk of accidental broad replacements).");
  }

  // Ensure the working directory is clean before attempting to rewrite history
  try {
    const { stdout: gitStatus } = await execAsync("git status --porcelain --untracked-files=no", { cwd: rootDir });
    if (gitStatus.trim().length > 0) {
      throw new Error("You have uncommitted or unstaged changes. Please commit or stash your changes before purging secrets from history.");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("uncommitted")) {
      throw err;
    }
    // If the check fails for some other reason (e.g. not a git repo), we ignore it here 
    // and let the filter-branch command handle/fail on it.
  }

  const secretB64 = Buffer.from(secretValue).toString('base64');
  
  const nodeScript = `
const fs = require('fs');
const path = require('path');
const secret = Buffer.from('${secretB64}', 'base64').toString('utf8');
function walk(dir) {
  for (let f of fs.readdirSync(dir)) {
    if (f === '.git') continue;
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else {
      try {
        let c = fs.readFileSync(p, 'utf8');
        if (c.includes(secret)) fs.writeFileSync(p, c.split(secret).join('[REDACTED_BY_BILT]'));
      } catch(e) {}
    }
  }
}
walk('.');
`;
  
  // Write the script to a temporary file in the OS temp directory
  // This avoids tricky shell escaping issues cross-platform (especially on Windows cmd.exe)
  const tmpFile = path.join(os.tmpdir(), `bilt-filter-${Date.now()}.js`);
  await fs.writeFile(tmpFile, nodeScript, 'utf8');
  
  // Use forward slashes for the path to avoid escape issues in shell
  const scriptPath = tmpFile.replace(/\\/g, '/');
  
  const filterBranchCmd = `git filter-branch --force --tree-filter "node \\"${scriptPath}\\"" HEAD`;

  try {
    await execAsync(filterBranchCmd, { cwd: rootDir });
    
    // Clean up backup refs cross-platform (avoiding xargs which is missing on Windows cmd)
    const { stdout } = await execAsync("git for-each-ref --format=%(refname) refs/original/", { cwd: rootDir });
    const refs = stdout.split('\n').map(r => r.trim()).filter(Boolean);
    for (const ref of refs) {
      await execAsync(`git update-ref -d ${ref}`, { cwd: rootDir }).catch(() => {});
    }
    
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to rewrite Git history: ${errorMsg}`);
  } finally {
    // Clean up the temporary script
    await fs.unlink(tmpFile).catch(() => {});
  }
}
