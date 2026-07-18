// ─── Provider Information & Detection ────────────────────────────────────────
//
// Maps cloud / SaaS providers to their credential-management pages
// so that Bilt can tell developers exactly where to rotate a leaked key.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProviderInfo, ProviderKnowledge } from "../../types/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Provider Definitions ────────────────────────────────────────────────────

const aws: ProviderInfo = {
  name: "aws",
  displayName: "Amazon Web Services",
  icon: "☁️",
  rotationUrl: "https://console.aws.amazon.com/iam/home#/security_credentials",
  docsUrl:
    "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
};

const stripe: ProviderInfo = {
  name: "stripe",
  displayName: "Stripe",
  icon: "💳",
  rotationUrl: "https://dashboard.stripe.com/apikeys",
  docsUrl: "https://docs.stripe.com/keys",
};

const openai: ProviderInfo = {
  name: "openai",
  displayName: "OpenAI",
  icon: "🤖",
  rotationUrl: "https://platform.openai.com/api-keys",
  docsUrl: "https://platform.openai.com/docs/api-reference/authentication",
};

const github: ProviderInfo = {
  name: "github",
  displayName: "GitHub",
  icon: "🐙",
  rotationUrl: "https://github.com/settings/tokens",
  docsUrl:
    "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
};

const supabase: ProviderInfo = {
  name: "supabase",
  displayName: "Supabase",
  icon: "⚡",
  rotationUrl: "https://app.supabase.com/project/_/settings/api",
  docsUrl: "https://supabase.com/docs/guides/api#api-keys",
};

const slack: ProviderInfo = {
  name: "slack",
  displayName: "Slack",
  icon: "💬",
  rotationUrl: "https://api.slack.com/apps",
  docsUrl: "https://api.slack.com/authentication/token-types",
};

const google: ProviderInfo = {
  name: "google",
  displayName: "Google Cloud",
  icon: "🔍",
  rotationUrl: "https://console.cloud.google.com/apis/credentials",
  docsUrl: "https://cloud.google.com/docs/authentication/api-keys",
};

const twilio: ProviderInfo = {
  name: "twilio",
  displayName: "Twilio",
  icon: "📞",
  rotationUrl: "https://www.twilio.com/console",
  docsUrl: "https://www.twilio.com/docs/iam/api-keys",
};

const sendgrid: ProviderInfo = {
  name: "sendgrid",
  displayName: "SendGrid",
  icon: "📧",
  rotationUrl: "https://app.sendgrid.com/settings/api_keys",
  docsUrl: "https://docs.sendgrid.com/ui/account-and-settings/api-keys",
};

const mailgun: ProviderInfo = {
  name: "mailgun",
  displayName: "Mailgun",
  icon: "📬",
  rotationUrl: "https://app.mailgun.com/app/account/security/api_keys",
  docsUrl: "https://documentation.mailgun.com/en/latest/api-intro.html",
};

const mailchimp: ProviderInfo = {
  name: "mailchimp",
  displayName: "Mailchimp",
  icon: "🐵",
  rotationUrl: "https://us1.admin.mailchimp.com/account/api/",
  docsUrl: "https://mailchimp.com/developer/marketing/guides/quick-start/",
};

const heroku: ProviderInfo = {
  name: "heroku",
  displayName: "Heroku",
  icon: "🟣",
  rotationUrl: "https://dashboard.heroku.com/account",
  docsUrl: "https://devcenter.heroku.com/articles/authentication",
};

const digitalocean: ProviderInfo = {
  name: "digitalocean",
  displayName: "DigitalOcean",
  icon: "🌊",
  rotationUrl: "https://cloud.digitalocean.com/account/api/tokens",
  docsUrl:
    "https://docs.digitalocean.com/reference/api/create-personal-access-token/",
};

const anthropic: ProviderInfo = {
  name: "anthropic",
  displayName: "Anthropic",
  icon: "🧠",
  rotationUrl: "https://console.anthropic.com/settings/keys",
  docsUrl: "https://docs.anthropic.com/en/api/getting-started",
};

const vercel: ProviderInfo = {
  name: "vercel",
  displayName: "Vercel",
  icon: "▲",
  rotationUrl: "https://vercel.com/account/tokens",
  docsUrl: "https://vercel.com/docs/rest-api/openapi",
};

const resend: ProviderInfo = {
  name: "resend",
  displayName: "Resend",
  icon: "✉️",
  rotationUrl: "https://resend.com/api-keys",
  docsUrl: "https://resend.com/docs/dashboard/api-keys/introduction",
};

const clerk: ProviderInfo = {
  name: "clerk",
  displayName: "Clerk",
  icon: "🔑",
  rotationUrl: "https://dashboard.clerk.com/",
  docsUrl: "https://clerk.com/docs/backend-requests/handling/overview",
};

const firebase: ProviderInfo = {
  name: "firebase",
  displayName: "Firebase",
  icon: "🔥",
  rotationUrl: "https://console.firebase.google.com/",
  docsUrl: "https://firebase.google.com/docs/admin/setup",
};

const mongodb: ProviderInfo = {
  name: "mongodb",
  displayName: "MongoDB",
  icon: "🍃",
  rotationUrl: "https://cloud.mongodb.com/",
  docsUrl: "https://www.mongodb.com/docs/manual/reference/connection-string/",
};

const postgres: ProviderInfo = {
  name: "postgres",
  displayName: "PostgreSQL",
  icon: "🐘",
  rotationUrl: "",
  docsUrl: "https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING",
};

// ─── Provider Map ────────────────────────────────────────────────────────────

export const PROVIDER_MAP: Map<string, ProviderInfo> = new Map([
  ["aws", aws],
  ["stripe", stripe],
  ["openai", openai],
  ["github", github],
  ["supabase", supabase],
  ["slack", slack],
  ["google", google],
  ["twilio", twilio],
  ["sendgrid", sendgrid],
  ["mailgun", mailgun],
  ["mailchimp", mailchimp],
  ["heroku", heroku],
  ["digitalocean", digitalocean],
  ["anthropic", anthropic],
  ["vercel", vercel],
  ["resend", resend],
  ["clerk", clerk],
  ["firebase", firebase],
  ["mongodb", mongodb],
  ["postgres", postgres],
]);

// ─── Value-based detection heuristics ────────────────────────────────────────
// Maps a substring / prefix found in the matched value to a provider name.

const VALUE_HINTS: Array<{ test: (v: string) => boolean; provider: string }> = [
  { test: (v) => v.startsWith("AKIA"), provider: "aws" },
  { test: (v) => /^sk_(live|test)_/.test(v), provider: "stripe" },
  { test: (v) => /^pk_(live|test)_/.test(v), provider: "stripe" },
  { test: (v) => /^rk_(live|test)_/.test(v), provider: "stripe" },
  { test: (v) => v.startsWith("sk-"), provider: "openai" },
  { test: (v) => /^gh[pousr]_/.test(v), provider: "github" },
  { test: (v) => /^xox[bps]-/.test(v), provider: "slack" },
  { test: (v) => v.includes("hooks.slack.com"), provider: "slack" },
  { test: (v) => v.startsWith("AIza"), provider: "google" },
  {
    test: (v) => v.startsWith("SK") && /^SK[0-9a-fA-F]{32}$/.test(v),
    provider: "twilio",
  },
  { test: (v) => v.startsWith("SG."), provider: "sendgrid" },
  { test: (v) => v.startsWith("sbp_"), provider: "supabase" },
  { test: (v) => v.startsWith("key-"), provider: "mailgun" },
  { test: (v) => /-us\d{1,2}$/.test(v), provider: "mailchimp" },
  { test: (v) => v.startsWith("dop_v1_"), provider: "digitalocean" },
];

// ─── Rule-ID to provider mapping ────────────────────────────────────────────
// Extracted from the rule definitions so we can resolve by ID without
// needing to re-import the rules (avoids circular deps).

const RULE_ID_PROVIDER: Record<string, string> = {
  "aws-access-key": "aws",
  "aws-secret-key": "aws",
  "stripe-secret-key": "stripe",
  "stripe-test-secret-key": "stripe",
  "stripe-publishable-key": "stripe",
  "stripe-restricted-key": "stripe",
  "openai-api-key": "openai",
  "github-token": "github",
  "slack-token": "slack",
  "slack-webhook": "slack",
  "google-api-key": "google",
  "twilio-api-key": "twilio",
  "sendgrid-api-key": "sendgrid",
  "supabase-service-key": "supabase",
  "mailgun-api-key": "mailgun",
  "mailchimp-api-key": "mailchimp",
  "heroku-api-key": "heroku",
  "digitalocean-token": "digitalocean",
  "anthropic-api-key": "anthropic",
  "vercel-token": "vercel",
  "resend-api-key": "resend",
  "clerk-secret-key": "clerk",
  "firebase-service-key": "firebase",
  "mongodb-uri": "mongodb",
  "postgres-uri": "postgres",
  "supabase-service-role": "supabase",
  "supabase-anon-key": "supabase",
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Attempt to identify which cloud provider a secret value belongs to.
 *
 * Resolution order:
 * 1. If a `matchedRuleId` is supplied and maps to a known provider, use that.
 * 2. Walk value-based heuristics (prefix / substring checks).
 * 3. Return `undefined` if the provider cannot be determined.
 */
export function detectProvider(
  value: string,
  matchedRuleId?: string,
): ProviderInfo | undefined {
  // 1. Try rule-ID lookup first (most reliable)
  if (matchedRuleId) {
    const providerName = RULE_ID_PROVIDER[matchedRuleId];
    if (providerName) {
      return PROVIDER_MAP.get(providerName);
    }
  }

  // 2. Value-based heuristics
  for (const hint of VALUE_HINTS) {
    if (hint.test(value)) {
      return PROVIDER_MAP.get(hint.provider);
    }
  }

  return undefined;
}

// ─── Provider Knowledge Loader ───────────────────────────────────────────────

let knowledgeCache: Record<string, ProviderKnowledge> | null = null;

export function getProviderKnowledge(ruleId: string): ProviderKnowledge | undefined {
  if (!knowledgeCache) {
    knowledgeCache = {};
    try {
      const knowledgeDir = join(__dirname, "knowledge");
      const files = readdirSync(knowledgeDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const content = readFileSync(join(knowledgeDir, file), "utf-8");
          const key = file.replace(/\.json$/, "");
          knowledgeCache[key] = JSON.parse(content) as ProviderKnowledge;
        }
      }
    } catch (error) {
      // Ignore if directory doesn't exist or permissions error
    }
  }
  return knowledgeCache[ruleId];
}
