import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { scanDependencies } from "../../src/core/scan/dependencies.js";

describe("Framework-Aware Dependency Detection", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-fw-dep-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should NOT flag react-dom or react as unused in a Next.js project", async () => {
    // Write package.json for Next.js app
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "my-next-app",
        dependencies: {
          next: "14.2.0",
          react: "18.2.0",
          "react-dom": "18.2.0",
        },
      }),
    );

    // Create an app/page.tsx that does NOT import react-dom
    await fs.mkdir(path.join(tempDir, "app"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "app", "page.tsx"),
      `export default function Page() { return <h1>Hello Next</h1>; }`,
    );

    const findings = await scanDependencies(tempDir);
    const unusedDom = findings.find(
      (f) => f.category === "dep-unused" && f.message.includes("react-dom"),
    );
    const unusedReact = findings.find(
      (f) => f.category === "dep-unused" && f.message.includes('"react"'),
    );

    expect(unusedDom).toBeUndefined();
    expect(unusedReact).toBeUndefined();
  });

  it("should respect ignoreUnused in configuration", async () => {
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "my-custom-app",
        dependencies: {
          lodash: "4.17.21",
          axios: "1.6.0",
        },
      }),
    );

    // Only lodash is imported
    await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "src", "index.ts"),
      `import lodash from "lodash";`,
    );

    // Without ignoreUnused: axios is flagged
    const findingsWithoutIgnore = await scanDependencies(tempDir);
    expect(
      findingsWithoutIgnore.some(
        (f) => f.category === "dep-unused" && f.message.includes("axios"),
      ),
    ).toBe(true);

    // With ignoreUnused: ["axios"]: axios is ignored
    const findingsWithIgnore = await scanDependencies(tempDir, {
      ignoreUnused: ["axios"],
    });
    expect(
      findingsWithIgnore.some(
        (f) => f.category === "dep-unused" && f.message.includes("axios"),
      ),
    ).toBe(false);
  });

  it("should support framework: 'nextjs' preset explicitly in config", async () => {
    // Project doesn't have "next" in package.json directly, but config specifies nextjs framework preset
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "custom-next-setup",
        dependencies: {
          react: "18.2.0",
          "react-dom": "18.2.0",
        },
      }),
    );

    await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "src", "main.ts"),
      `console.log("hello");`,
    );

    const findings = await scanDependencies(tempDir, { framework: "nextjs" });
    const unusedDom = findings.find(
      (f) => f.category === "dep-unused" && f.message.includes("react-dom"),
    );
    expect(unusedDom).toBeUndefined();
  });

  it("should recognize Supabase SSR transitive dependencies without false positives", async () => {
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "supabase-app",
        dependencies: {
          "@supabase/ssr": "^0.5.0",
          "@supabase/supabase-js": "^2.45.0",
        },
      }),
    );

    await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "src", "client.ts"),
      `import { createBrowserClient } from "@supabase/ssr";`,
    );

    const findings = await scanDependencies(tempDir);
    const unusedSupabase = findings.find(
      (f) => f.category === "dep-unused" && f.message.includes("@supabase/supabase-js"),
    );
    expect(unusedSupabase).toBeUndefined();
  });
});
