// ─── Universal Ecosystem Auto-Detector ────────────────────────────────────────
// Zero-configuration detection for JS/TS stack components, frameworks, databases,
// deployment targets, package managers, AI providers, and dev services.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

export interface DetectedTech {
  id: string;
  name: string;
  category:
    | "frontend"
    | "backend"
    | "mobile-desktop"
    | "package-manager"
    | "build-tool"
    | "database"
    | "deployment"
    | "ci-cd"
    | "auth"
    | "ai-provider"
    | "dev-service";
  clientExposedPrefix?: string;
  configFiles?: string[];
  docsUrl?: string;
}

export interface EcosystemProfile {
  primaryFramework?: DetectedTech;
  frontend: DetectedTech[];
  backend: DetectedTech[];
  mobileDesktop: DetectedTech[];
  packageManager: DetectedTech;
  buildTools: DetectedTech[];
  databases: DetectedTech[];
  deployment: DetectedTech[];
  ciCd: DetectedTech[];
  auth: DetectedTech[];
  aiProviders: DetectedTech[];
  devServices: DetectedTech[];
  allDetected: DetectedTech[];
  clientExposedPrefixes: string[];
}

// ─── Known Technologies Registry ─────────────────────────────────────────────

const TECH_CATALOG: DetectedTech[] = [
  // Frontend
  { id: "react", name: "React", category: "frontend", clientExposedPrefix: "REACT_APP_", docsUrl: "https://react.dev" },
  { id: "nextjs", name: "Next.js", category: "frontend", clientExposedPrefix: "NEXT_PUBLIC_", configFiles: ["next.config.js", "next.config.mjs", "next.config.ts"], docsUrl: "https://nextjs.org" },
  { id: "vite", name: "Vite", category: "frontend", clientExposedPrefix: "VITE_", configFiles: ["vite.config.js", "vite.config.ts", "vite.config.mjs"], docsUrl: "https://vitejs.dev" },
  { id: "vue", name: "Vue.js", category: "frontend", clientExposedPrefix: "VUE_APP_", docsUrl: "https://vuejs.org" },
  { id: "nuxt", name: "Nuxt", category: "frontend", clientExposedPrefix: "NUXT_PUBLIC_", configFiles: ["nuxt.config.ts", "nuxt.config.js"], docsUrl: "https://nuxt.com" },
  { id: "astro", name: "Astro", category: "frontend", clientExposedPrefix: "PUBLIC_", configFiles: ["astro.config.mjs", "astro.config.ts"], docsUrl: "https://astro.build" },
  { id: "svelte", name: "Svelte", category: "frontend", clientExposedPrefix: "VITE_", docsUrl: "https://svelte.dev" },
  { id: "sveltekit", name: "SvelteKit", category: "frontend", clientExposedPrefix: "PUBLIC_", configFiles: ["svelte.config.js"], docsUrl: "https://kit.svelte.dev" },
  { id: "solidjs", name: "SolidJS", category: "frontend", clientExposedPrefix: "VITE_", docsUrl: "https://solidjs.com" },
  { id: "qwik", name: "Qwik", category: "frontend", clientExposedPrefix: "PUBLIC_", configFiles: ["vite.config.ts"], docsUrl: "https://qwik.dev" },
  { id: "remix", name: "Remix", category: "frontend", clientExposedPrefix: "REMIX_PUBLIC_", configFiles: ["remix.config.js", "vite.config.ts"], docsUrl: "https://remix.run" },
  { id: "gatsby", name: "Gatsby", category: "frontend", clientExposedPrefix: "GATSBY_", configFiles: ["gatsby-config.js", "gatsby-config.ts"], docsUrl: "https://gatsbyjs.com" },
  { id: "angular", name: "Angular", category: "frontend", clientExposedPrefix: "NG_APP_", configFiles: ["angular.json"], docsUrl: "https://angular.dev" },

  // Backend
  { id: "nodejs", name: "Node.js", category: "backend", docsUrl: "https://nodejs.org" },
  { id: "express", name: "Express", category: "backend", docsUrl: "https://expressjs.com" },
  { id: "nestjs", name: "NestJS", category: "backend", configFiles: ["nest-cli.json"], docsUrl: "https://nestjs.com" },
  { id: "fastify", name: "Fastify", category: "backend", docsUrl: "https://fastify.dev" },
  { id: "hono", name: "Hono", category: "backend", docsUrl: "https://hono.dev" },
  { id: "koa", name: "Koa", category: "backend", docsUrl: "https://koajs.com" },
  { id: "adonisjs", name: "AdonisJS", category: "backend", configFiles: ["adonisrc.json"], docsUrl: "https://adonisjs.com" },

  // Mobile / Desktop
  { id: "react-native", name: "React Native", category: "mobile-desktop", docsUrl: "https://reactnative.dev" },
  { id: "expo", name: "Expo", category: "mobile-desktop", clientExposedPrefix: "EXPO_PUBLIC_", configFiles: ["app.json", "app.config.js", "app.config.ts"], docsUrl: "https://expo.dev" },
  { id: "ionic", name: "Ionic", category: "mobile-desktop", configFiles: ["ionic.config.json"], docsUrl: "https://ionicframework.com" },
  { id: "capacitor", name: "Capacitor", category: "mobile-desktop", configFiles: ["capacitor.config.ts", "capacitor.config.json"], docsUrl: "https://capacitorjs.com" },
  { id: "electron", name: "Electron", category: "mobile-desktop", configFiles: ["electron-builder.json"], docsUrl: "https://electronjs.org" },
  { id: "tauri", name: "Tauri", category: "mobile-desktop", configFiles: ["src-tauri/tauri.conf.json"], docsUrl: "https://tauri.app" },

  // Package Managers
  { id: "pnpm", name: "pnpm", category: "package-manager" },
  { id: "yarn", name: "Yarn", category: "package-manager" },
  { id: "bun", name: "Bun", category: "package-manager" },
  { id: "npm", name: "npm", category: "package-manager" },

  // Build Tools
  { id: "turborepo", name: "Turborepo", category: "build-tool", configFiles: ["turbo.json"] },
  { id: "nx", name: "Nx", category: "build-tool", configFiles: ["nx.json"] },
  { id: "webpack", name: "Webpack", category: "build-tool", configFiles: ["webpack.config.js", "webpack.config.ts"] },
  { id: "rollup", name: "Rollup", category: "build-tool", configFiles: ["rollup.config.js", "rollup.config.mjs"] },
  { id: "esbuild", name: "esbuild", category: "build-tool" },

  // Databases & ORMs
  { id: "prisma", name: "Prisma", category: "database", configFiles: ["prisma/schema.prisma"] },
  { id: "drizzle", name: "Drizzle ORM", category: "database", configFiles: ["drizzle.config.ts", "drizzle.config.js"] },
  { id: "supabase", name: "Supabase", category: "database", configFiles: ["supabase/config.toml"] },
  { id: "firebase", name: "Firebase", category: "database", configFiles: ["firebase.json"] },
  { id: "mongodb", name: "MongoDB", category: "database" },
  { id: "postgresql", name: "PostgreSQL", category: "database" },
  { id: "mysql", name: "MySQL", category: "database" },
  { id: "redis", name: "Redis", category: "database" },
  { id: "sqlite", name: "SQLite", category: "database" },
  { id: "turso", name: "Turso", category: "database" },
  { id: "neon", name: "Neon", category: "database" },

  // Deployment
  { id: "vercel", name: "Vercel", category: "deployment", configFiles: ["vercel.json"] },
  { id: "netlify", name: "Netlify", category: "deployment", configFiles: ["netlify.toml"] },
  { id: "railway", name: "Railway", category: "deployment", configFiles: ["railway.json", "railway.toml"] },
  { id: "render", name: "Render", category: "deployment", configFiles: ["render.yaml"] },
  { id: "fly.io", name: "Fly.io", category: "deployment", configFiles: ["fly.toml"] },
  { id: "cloudflare", name: "Cloudflare Workers / Pages", category: "deployment", configFiles: ["wrangler.toml", "wrangler.json"] },
  { id: "docker", name: "Docker", category: "deployment", configFiles: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"] },

  // CI/CD
  { id: "github-actions", name: "GitHub Actions", category: "ci-cd", configFiles: [".github/workflows"] },
  { id: "gitlab-ci", name: "GitLab CI", category: "ci-cd", configFiles: [".gitlab-ci.yml"] },
  { id: "circleci", name: "CircleCI", category: "ci-cd", configFiles: [".circleci/config.yml"] },

  // Auth
  { id: "clerk", name: "Clerk", category: "auth" },
  { id: "better-auth", name: "Better Auth", category: "auth" },
  { id: "authjs", name: "Auth.js / NextAuth", category: "auth" },
  { id: "firebase-auth", name: "Firebase Auth", category: "auth" },
  { id: "supabase-auth", name: "Supabase Auth", category: "auth" },
  { id: "auth0", name: "Auth0", category: "auth" },

  // AI Providers
  { id: "openai", name: "OpenAI", category: "ai-provider" },
  { id: "anthropic", name: "Anthropic", category: "ai-provider" },
  { id: "gemini", name: "Google Gemini", category: "ai-provider" },
  { id: "groq", name: "Groq", category: "ai-provider" },
  { id: "cohere", name: "Cohere", category: "ai-provider" },
  { id: "huggingface", name: "Hugging Face", category: "ai-provider" },

  // Developer Services
  { id: "stripe", name: "Stripe", category: "dev-service" },
  { id: "resend", name: "Resend", category: "dev-service" },
  { id: "sendgrid", name: "SendGrid", category: "dev-service" },
  { id: "twilio", name: "Twilio", category: "dev-service" },
  { id: "discord", name: "Discord API", category: "dev-service" },
  { id: "slack", name: "Slack API", category: "dev-service" },
  { id: "github-api", name: "GitHub API", category: "dev-service" },
  { id: "cloudinary", name: "Cloudinary", category: "dev-service" },
  { id: "uploadthing", name: "UploadThing", category: "dev-service" },
  { id: "sentry", name: "Sentry", category: "dev-service" },
  { id: "posthog", name: "PostHog", category: "dev-service" },
  { id: "upstash", name: "Upstash", category: "dev-service" },
];

// Package name mapping for instant dependency checks
const PACKAGE_MAP: Record<string, string> = {
  react: "react",
  next: "nextjs",
  vite: "vite",
  vue: "vue",
  nuxt: "nuxt",
  astro: "astro",
  svelte: "svelte",
  "@sveltejs/kit": "sveltekit",
  "solid-js": "solidjs",
  "@builder.io/qwik": "qwik",
  "@remix-run/react": "remix",
  gatsby: "gatsby",
  "@angular/core": "angular",
  express: "express",
  "@nestjs/core": "nestjs",
  fastify: "fastify",
  hono: "hono",
  koa: "koa",
  "@adonisjs/core": "adonisjs",
  "react-native": "react-native",
  expo: "expo",
  "@ionic/react": "ionic",
  "@ionic/vue": "ionic",
  "@ionic/angular": "ionic",
  "@capacitor/core": "capacitor",
  electron: "electron",
  "@tauri-apps/api": "tauri",
  turbo: "turborepo",
  nx: "nx",
  webpack: "webpack",
  rollup: "rollup",
  esbuild: "esbuild",
  "@prisma/client": "prisma",
  prisma: "prisma",
  "drizzle-orm": "drizzle",
  "@supabase/supabase-js": "supabase",
  firebase: "firebase",
  mongoose: "mongodb",
  mongodb: "mongodb",
  pg: "postgresql",
  mysql2: "mysql",
  redis: "redis",
  ioredis: "redis",
  "better-sqlite3": "sqlite",
  sqlite3: "sqlite",
  "@libsql/client": "turso",
  "@neondatabase/serverless": "neon",
  "@clerk/nextjs": "clerk",
  "@clerk/clerk-react": "clerk",
  "better-auth": "better-auth",
  "next-auth": "authjs",
  "@auth/core": "authjs",
  auth0: "auth0",
  openai: "openai",
  "@anthropic-ai/sdk": "anthropic",
  "@google/generative-ai": "gemini",
  groq: "groq",
  cohere: "cohere",
  "@huggingface/inference": "huggingface",
  stripe: "stripe",
  resend: "resend",
  "@sendgrid/mail": "sendgrid",
  twilio: "twilio",
  "discord.js": "discord",
  "@slack/web-api": "slack",
  "@octokit/rest": "github-api",
  cloudinary: "cloudinary",
  uploadthing: "uploadthing",
  "@sentry/nextjs": "sentry",
  "@sentry/node": "sentry",
  "@sentry/react": "sentry",
  "posthog-js": "posthog",
  "posthog-node": "posthog",
  "@upstash/redis": "upstash",
};

/**
 * Detect all ecosystems in the workspace.
 */
export async function detectEcosystem(rootDir: string): Promise<EcosystemProfile> {
  const detectedMap = new Map<string, DetectedTech>();

  // 1. Check package.json dependencies
  let allDeps: Record<string, string> = {};
  try {
    const pkgContent = await fs.readFile(path.join(rootDir, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgContent);
    allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.peerDependencies || {}),
    };
    detectedMap.set("nodejs", TECH_CATALOG.find((t) => t.id === "nodejs")!);
  } catch {
    // No package.json
  }

  for (const [depName, techId] of Object.entries(PACKAGE_MAP)) {
    if (allDeps[depName]) {
      const tech = TECH_CATALOG.find((t) => t.id === techId);
      if (tech) detectedMap.set(tech.id, tech);
    }
  }

  // 2. Check config files
  for (const tech of TECH_CATALOG) {
    if (!tech.configFiles) continue;
    for (const configFile of tech.configFiles) {
      const targetPath = path.join(rootDir, configFile);
      if (fsSync.existsSync(targetPath)) {
        detectedMap.set(tech.id, tech);
        break;
      }
    }
  }

  // 3. Detect Package Manager by lockfile
  let pm: DetectedTech = TECH_CATALOG.find((t) => t.id === "npm")!;
  if (fsSync.existsSync(path.join(rootDir, "pnpm-lock.yaml"))) {
    pm = TECH_CATALOG.find((t) => t.id === "pnpm")!;
  } else if (fsSync.existsSync(path.join(rootDir, "yarn.lock"))) {
    pm = TECH_CATALOG.find((t) => t.id === "yarn")!;
  } else if (fsSync.existsSync(path.join(rootDir, "bun.lockb")) || fsSync.existsSync(path.join(rootDir, "bun.lock"))) {
    pm = TECH_CATALOG.find((t) => t.id === "bun")!;
  }
  detectedMap.set(pm.id, pm);

  // Group by category
  const allDetected = Array.from(detectedMap.values());
  const frontend = allDetected.filter((t) => t.category === "frontend");
  const backend = allDetected.filter((t) => t.category === "backend");
  const mobileDesktop = allDetected.filter((t) => t.category === "mobile-desktop");
  const buildTools = allDetected.filter((t) => t.category === "build-tool");
  const databases = allDetected.filter((t) => t.category === "database");
  const deployment = allDetected.filter((t) => t.category === "deployment");
  const ciCd = allDetected.filter((t) => t.category === "ci-cd");
  const auth = allDetected.filter((t) => t.category === "auth");
  const aiProviders = allDetected.filter((t) => t.category === "ai-provider");
  const devServices = allDetected.filter((t) => t.category === "dev-service");

  // Determine primary framework
  const primaryFramework =
    frontend.find((f) => f.id === "nextjs" || f.id === "nuxt" || f.id === "astro" || f.id === "remix" || f.id === "sveltekit") ||
    frontend[0] ||
    backend[0];

  const clientExposedPrefixes = Array.from(
    new Set(allDetected.map((t) => t.clientExposedPrefix).filter(Boolean) as string[]),
  );
  if (clientExposedPrefixes.length === 0) {
    clientExposedPrefixes.push("PUBLIC_");
  }

  return {
    primaryFramework,
    frontend,
    backend,
    mobileDesktop,
    packageManager: pm,
    buildTools,
    databases,
    deployment,
    ciCd,
    auth,
    aiProviders,
    devServices,
    allDetected,
    clientExposedPrefixes,
  };
}
