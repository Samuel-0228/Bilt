import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Surgically removes a string from Git history using git filter-branch.
 * Note: This replaces the exact string with [REDACTED_BY_BILT] across all commits in all files.
 */
export async function purgeSecretFromHistory(rootDir: string, secretValue: string): Promise<boolean> {
  if (!secretValue || secretValue.length < 5) {
    throw new Error("Secret value is too short to safely purge from history (risk of accidental broad replacements).");
  }

  // We use node and base64 to safely replace the string cross-platform without breaking on special characters
  const secretB64 = Buffer.from(secretValue).toString('base64');
  
  const nodeScript = `
    const fs=require('fs');
    const path=require('path');
    const secret=Buffer.from('${secretB64}','base64').toString('utf8');
    function walk(dir) {
      for(let f of fs.readdirSync(dir)){
        if(f==='.git') continue;
        let p=path.join(dir,f);
        if(fs.statSync(p).isDirectory()) walk(p);
        else {
          try {
            let c=fs.readFileSync(p,'utf8');
            if(c.includes(secret)) fs.writeFileSync(p, c.split(secret).join('[REDACTED_BY_BILT]'));
          } catch(e){}
        }
      }
    }
    walk('.');
  `.replace(/\n/g, " ");
  
  const filterBranchCmd = `git filter-branch --force --tree-filter "node -e \\"${nodeScript}\\"" HEAD`;

  try {
    await execAsync(filterBranchCmd, { cwd: rootDir });
    // Clean up backup refs
    await execAsync("git for-each-ref --format=\\%(refname) refs/original/ | xargs -n 1 git update-ref -d", { cwd: rootDir }).catch(() => {});
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to rewrite Git history: ${errorMsg}`);
  }
}
