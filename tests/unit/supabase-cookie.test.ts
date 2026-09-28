import { describe, it, expect } from "vitest";
import { authChecker } from "../../src/core/readiness/checks/auth.js";
import type { CheckContext } from "../../src/core/readiness/check-runner.js";

function createContext(files: Array<{ path: string; content: string }>): CheckContext {
  return {
    rootDir: "/mock/repo",
    files: files.map((f) => ({
      path: f.path,
      content: f.content,
      size: f.content.length,
      isModified: true,
      category: "source",
    })),
    gitScope: {
      hasGit: false,
      changedFiles: new Set(files.map((f) => f.path)),
      diffHunks: new Map(),
    },
    ecosystem: {
      frontend: [],
      backend: [],
      mobileDesktop: [],
      packageManager: { id: "npm", name: "npm", category: "package-manager" },
      buildTools: [],
      databases: [],
      deployment: [],
      ciCd: [],
      auth: [],
      aiProviders: [],
      devServices: [],
      allDetected: [],
      clientExposedPrefixes: [],
    },
  };
}

describe("Supabase SSR Cookie Security Analysis", () => {
  it("should suppress CHECK-AUTH-004 and 005 when cookie options are forwarded dynamically in Supabase SSR", async () => {
    const middlewareContent = `
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return supabaseResponse;
}
`;

    const context = createContext([
      { path: "utils/supabase/middleware.ts", content: middlewareContent },
    ]);

    const findings = await authChecker.run(context);
    const cookieFindings = findings.filter(
      (f) => f.ruleId === "CHECK-AUTH-004" || f.ruleId === "CHECK-AUTH-005",
    );

    expect(cookieFindings).toHaveLength(0);
  });

  it("should provide context-aware guidance with getAll/setAll snippet when static cookie lacks flags in Supabase file", async () => {
    const brokenSupabaseFile = `
import { createServerClient } from "@supabase/ssr";

export function handleAuth(req: any) {
  // Developer manually setting a cookie without forwarding options
  req.cookies.set("user_session", "session-val-123");
}
`;

    const context = createContext([
      { path: "lib/auth.ts", content: brokenSupabaseFile },
    ]);

    const findings = await authChecker.run(context);
    const auth004 = findings.find((f) => f.ruleId === "CHECK-AUTH-004");

    expect(auth004).toBeDefined();
    expect(auth004?.technicalDetail).toContain("getAll()");
    expect(auth004?.technicalDetail).toContain("setAll(cookiesToSet)");
    expect(auth004?.agentAction).toContain("setAll");
  });

  it("should flag missing httpOnly in standard non-Supabase cookie handling", async () => {
    const standardExpress = `
export function login(req: any, res: any) {
  res.cookie("auth_token", "jwt-payload", {
    path: "/",
    sameSite: "lax",
  });
}
`;

    const context = createContext([
      { path: "routes/auth.ts", content: standardExpress },
    ]);

    const findings = await authChecker.run(context);
    const auth004 = findings.find((f) => f.ruleId === "CHECK-AUTH-004");

    expect(auth004).toBeDefined();
    expect(auth004?.agentAction).toBe("Add httpOnly: true to the cookie options.");
  });
});
