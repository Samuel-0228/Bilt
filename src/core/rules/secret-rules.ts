// ─── Secret Detection Rules ──────────────────────────────────────────────────
//
// A curated list of regex-based rules for detecting leaked secrets,
// API keys, tokens, and credentials in source code and .env files.
//
// Each rule specifies:
//   • A globally-unique `id` (used for severity overrides & ignoring)
//   • A descriptive `name` shown in CLI output
//   • A `pattern` regex (with the `g` flag so scanners can find all matches)
//   • An optional `provider` key mapping into the PROVIDER_MAP
//   • A `severity` level
//   • A human-readable `description`
// ─────────────────────────────────────────────────────────────────────────────

import type { SecretRule } from '../../types/index.js';

export const SECRET_RULES: SecretRule[] = [
  // ── AWS ──────────────────────────────────────────────────────────────
  {
    id: 'aws-access-key',
    name: 'AWS Access Key ID',
    pattern: /(?<![A-Z0-9])AKIA[0-9A-Z]{16}(?![A-Z0-9])/g,
    provider: 'aws',
    severity: 'critical',
    description: 'AWS Access Key IDs always start with AKIA followed by 16 alphanumeric characters.',
  },
  {
    id: 'aws-secret-key',
    name: 'AWS Secret Access Key',
    pattern: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g,
    provider: 'aws',
    severity: 'critical',
    description: 'AWS Secret Access Keys are 40-character base64 strings.',
  },

  // ── Stripe ───────────────────────────────────────────────────────────
  {
    id: 'stripe-secret-key',
    name: 'Stripe Secret Key',
    pattern: /sk_live_[a-zA-Z0-9]{24,}/g,
    provider: 'stripe',
    severity: 'critical',
    description: 'Stripe live secret key — grants full API access.',
  },
  {
    id: 'stripe-test-secret-key',
    name: 'Stripe Test Secret Key',
    pattern: /sk_test_[a-zA-Z0-9]{24,}/g,
    provider: 'stripe',
    severity: 'warning',
    description: 'Stripe test secret key — should still not be committed.',
  },
  {
    id: 'stripe-publishable-key',
    name: 'Stripe Publishable Key',
    pattern: /pk_(live|test)_[a-zA-Z0-9]{24,}/g,
    provider: 'stripe',
    severity: 'info',
    description: 'Stripe publishable key — safe for client bundles but tracked for awareness.',
  },
  {
    id: 'stripe-restricted-key',
    name: 'Stripe Restricted Key',
    pattern: /rk_(live|test)_[a-zA-Z0-9]{24,}/g,
    provider: 'stripe',
    severity: 'critical',
    description: 'Stripe restricted key with custom permissions.',
  },

  // ── OpenAI ───────────────────────────────────────────────────────────
  {
    id: 'openai-api-key',
    name: 'OpenAI API Key',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    provider: 'openai',
    severity: 'critical',
    description: 'OpenAI API key — grants access to GPT and other models.',
  },

  // ── GitHub ───────────────────────────────────────────────────────────
  {
    id: 'github-token',
    name: 'GitHub Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    provider: 'github',
    severity: 'critical',
    description: 'GitHub personal access token, OAuth token, or app token.',
  },

  // ── Slack ────────────────────────────────────────────────────────────
  {
    id: 'slack-token',
    name: 'Slack Token',
    pattern: /xox[bps]-[0-9]+-[0-9]+-[a-zA-Z0-9]+/g,
    provider: 'slack',
    severity: 'critical',
    description: 'Slack bot, user, or app token.',
  },
  {
    id: 'slack-webhook',
    name: 'Slack Webhook URL',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[a-zA-Z0-9]+/g,
    provider: 'slack',
    severity: 'critical',
    description: 'Slack incoming webhook URL — can post messages to a channel.',
  },

  // ── Google ───────────────────────────────────────────────────────────
  {
    id: 'google-api-key',
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    provider: 'google',
    severity: 'critical',
    description: 'Google Cloud / Maps / Firebase API key.',
  },

  // ── Twilio ───────────────────────────────────────────────────────────
  {
    id: 'twilio-api-key',
    name: 'Twilio API Key',
    pattern: /SK[0-9a-fA-F]{32}/g,
    provider: 'twilio',
    severity: 'critical',
    description: 'Twilio API key SID.',
  },

  // ── SendGrid ─────────────────────────────────────────────────────────
  {
    id: 'sendgrid-api-key',
    name: 'SendGrid API Key',
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
    provider: 'sendgrid',
    severity: 'critical',
    description: 'SendGrid API key.',
  },

  // ── Supabase ─────────────────────────────────────────────────────────
  {
    id: 'supabase-service-key',
    name: 'Supabase Service Role Key',
    pattern: /sbp_[a-f0-9]{40}/g,
    provider: 'supabase',
    severity: 'critical',
    description: 'Supabase service-role key — bypasses RLS.',
  },

  // ── Database URLs ────────────────────────────────────────────────────
  {
    id: 'database-url',
    name: 'Database Connection String',
    pattern: /(postgres|postgresql|mysql|mongodb|mongodb\+srv):\/\/[^\s"'`]+:[^\s"'`]+@[^\s"'`]+/g,
    severity: 'critical',
    description: 'Database connection string with embedded credentials.',
  },

  // ── JWT ──────────────────────────────────────────────────────────────
  {
    id: 'jwt-token',
    name: 'JSON Web Token',
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    severity: 'warning',
    description: 'JSON Web Token — may contain sensitive claims.',
  },

  // ── Private Keys ─────────────────────────────────────────────────────
  {
    id: 'private-key',
    name: 'Private Key',
    pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'PEM-encoded private key header.',
  },

  // ── Mailgun ──────────────────────────────────────────────────────────
  {
    id: 'mailgun-api-key',
    name: 'Mailgun API Key',
    pattern: /key-[a-f0-9]{32}/g,
    provider: 'mailgun',
    severity: 'critical',
    description: 'Mailgun API key.',
  },

  // ── Mailchimp ────────────────────────────────────────────────────────
  {
    id: 'mailchimp-api-key',
    name: 'Mailchimp API Key',
    pattern: /[a-f0-9]{32}-us\d{1,2}/g,
    provider: 'mailchimp',
    severity: 'critical',
    description: 'Mailchimp API key — includes datacenter suffix.',
  },

  // ── Heroku ───────────────────────────────────────────────────────────
  {
    id: 'heroku-api-key',
    name: 'Heroku API Key',
    pattern: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    provider: 'heroku',
    severity: 'warning',
    description: 'Heroku API key (UUID format).',
  },

  // ── DigitalOcean ─────────────────────────────────────────────────────
  {
    id: 'digitalocean-token',
    name: 'DigitalOcean Token',
    pattern: /dop_v1_[a-f0-9]{64}/g,
    provider: 'digitalocean',
    severity: 'critical',
    description: 'DigitalOcean personal access token.',
  },

  // ── Generic high-entropy assignment (catch-all) ──────────────────────
  {
    id: 'generic-high-entropy',
    name: 'High-Entropy String',
    pattern:
      /(?:api[_-]?key|api[_-]?secret|auth[_-]?token|access[_-]?token|secret[_-]?key|private[_-]?key|password|passwd|credential)\s*[:=]\s*['"]([A-Za-z0-9/+=_\-.]{16,})['"/]?/gi,
    severity: 'warning',
    description:
      'Assignment of a high-entropy string to a variable with a secret-like name.',
  },
];
