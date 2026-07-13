import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripeSecretVal = "sk_" + "test_4eC39HqLyjWDarjtT1zdp7dc";
const awsAccessKeyVal = "AKIAIOSFODNN7EXAMPLE";
// High entropy 40-char string containing / and +
const awsSecretKeyVal = "wq+32jD/S/b0123456789abcde123456789abcde";
const jwtVal =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3ZXJ0eSJ9." +
  "signature";

const cleanEnv = { ...process.env };
delete cleanEnv.GIT_DIR;
delete cleanEnv.GIT_WORK_TREE;

export async function createLeakyFixtureProject(
  targetDir: string,
): Promise<string> {
  const sourceDir = path.resolve(__dirname, "./leaky-project");

  await fs.mkdir(path.join(targetDir, "src"), { recursive: true });

  // Initialize git repo to isolate from parent git repos
  await execa("git", ["init"], { cwd: targetDir, env: cleanEnv });

  await fs.copyFile(
    path.join(sourceDir, "package.json"),
    path.join(targetDir, "package.json"),
  );

  let indexContent = await fs.readFile(
    path.join(sourceDir, "src/index.ts-source"),
    "utf-8",
  );
  indexContent = indexContent
    .replace("STRIPE_SECRET_KEY_PLACEHOLDER", stripeSecretVal)
    .replace("AWS_ACCESS_KEY_PLACEHOLDER", awsAccessKeyVal)
    .replace("AWS_SECRET_KEY_PLACEHOLDER", awsSecretKeyVal);
  await fs.writeFile(
    path.join(targetDir, "src/index.ts"),
    indexContent,
    "utf-8",
  );

  let envContent = await fs.readFile(
    path.join(sourceDir, ".env-source"),
    "utf-8",
  );
  envContent = envContent
    .replace("STRIPE_SECRET_KEY_PLACEHOLDER", stripeSecretVal)
    .replace("JWT_PLACEHOLDER", jwtVal);
  await fs.writeFile(path.join(targetDir, ".env"), envContent, "utf-8");

  let envProdContent = await fs.readFile(
    path.join(sourceDir, ".env.production-source"),
    "utf-8",
  );
  await fs.writeFile(
    path.join(targetDir, ".env.production"),
    envProdContent,
    "utf-8",
  );

  return targetDir;
}

export async function createNextjsFixtureProject(
  targetDir: string,
): Promise<string> {
  const sourceDir = path.resolve(__dirname, "./nextjs-project");

  await fs.mkdir(targetDir, { recursive: true });
  await execa("git", ["init"], { cwd: targetDir, env: cleanEnv });

  await fs.copyFile(
    path.join(sourceDir, "package.json"),
    path.join(targetDir, "package.json"),
  );

  let envContent = await fs.readFile(
    path.join(sourceDir, ".env-source"),
    "utf-8",
  );
  envContent = envContent.replace(
    "STRIPE_SECRET_KEY_PLACEHOLDER",
    stripeSecretVal,
  );
  await fs.writeFile(path.join(targetDir, ".env"), envContent, "utf-8");

  return targetDir;
}

export async function createViteFixtureProject(
  targetDir: string,
): Promise<string> {
  const sourceDir = path.resolve(__dirname, "./vite-project");

  await fs.mkdir(targetDir, { recursive: true });
  await execa("git", ["init"], { cwd: targetDir, env: cleanEnv });

  await fs.copyFile(
    path.join(sourceDir, "package.json"),
    path.join(targetDir, "package.json"),
  );

  let envContent = await fs.readFile(
    path.join(sourceDir, ".env-source"),
    "utf-8",
  );
  envContent = envContent.replace(
    "STRIPE_SECRET_KEY_PLACEHOLDER",
    stripeSecretVal,
  );
  await fs.writeFile(path.join(targetDir, ".env"), envContent, "utf-8");

  return targetDir;
}
