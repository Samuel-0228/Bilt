import type { FrameworkKnowledge, ProviderKnowledgeItem } from "../types.js";

export const FRAMEWORK_KNOWLEDGE_BASE: Record<string, FrameworkKnowledge> = {
  nextjs: {
    id: "nextjs",
    displayName: "Next.js",
    clientExposedEnvPrefixes: ["NEXT_PUBLIC_"],
    safePatterns: [
      "export async function GET(request: Request) { const session = await getServerSession(authOptions); ... }",
      "import { headers } from 'next/headers'; verifySession(headers().get('authorization'));",
    ],
    unsafePatterns: [
      "process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
      "const isAdmin = req.body.isAdmin; // trusting client input for authorization",
      "jwt.decode(token); // without signature verification",
      "eval(aiGeneratedCode);",
    ],
    recommendedPatterns: [
      "Use Server Actions with authentication checks inside the action body.",
      "Never put service_role or database passwords in NEXT_PUBLIC_ variables.",
    ],
    knownMistakes: [
      "AI code generators frequently place backend database credentials inside NEXT_PUBLIC_ env vars.",
      "Using jwt.decode() instead of jwt.verify() in Middleware or Route Handlers.",
    ],
  },
  react: {
    id: "react",
    displayName: "React",
    clientExposedEnvPrefixes: ["VITE_PUBLIC_", "REACT_APP_"],
    safePatterns: ["dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}"],
    unsafePatterns: [
      "dangerouslySetInnerHTML={{ __html: userInput }}",
      "localStorage.setItem('admin_token', token)",
      "if (user.role === 'admin') showAdminPanel() // frontend-only authz",
    ],
    recommendedPatterns: [
      "Sanitize any HTML before rendering.",
      "Do not rely solely on React state or localStorage for security checks.",
    ],
    knownMistakes: [
      "Copy-paste tutorials checking admin permissions only in React components without backend enforcement.",
    ],
  },
  express: {
    id: "express",
    displayName: "Express.js",
    clientExposedEnvPrefixes: [],
    safePatterns: [
      "app.use(helmet());",
      "app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));",
      "router.get('/admin', authenticateToken, requireAdmin, handler);",
    ],
    unsafePatterns: [
      "app.use(cors({ origin: '*', credentials: true }));",
      "child_process.exec(`ping ${req.query.host}`);",
      "res.status(500).json({ error: err.stack });",
    ],
    recommendedPatterns: [
      "Enforce authentication and authorization middleware on all non-public endpoints.",
      "Use parameterized queries for database operations.",
    ],
    knownMistakes: [
      "Disabling CORS restrictions with wildcard origins and allowed credentials.",
      "Exposing full error stack traces in production API responses.",
    ],
  },
  supabase: {
    id: "supabase",
    displayName: "Supabase",
    clientExposedEnvPrefixes: ["NEXT_PUBLIC_", "VITE_"],
    safePatterns: [
      "const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);",
      "Enable Row Level Security (RLS) on all tables.",
    ],
    unsafePatterns: [
      "const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY); // in frontend",
      "ALTER TABLE users DISABLE ROW LEVEL SECURITY;",
    ],
    recommendedPatterns: [
      "Keep SUPABASE_SERVICE_ROLE_KEY exclusively on backend server environments.",
      "Always write explicit RLS policies forSELECT, INSERT, UPDATE, DELETE.",
    ],
    knownMistakes: [
      "Exposing SUPABASE_SERVICE_ROLE_KEY in frontend React/Next.js code to bypass RLS.",
    ],
  },
  firebase: {
    id: "firebase",
    displayName: "Firebase",
    clientExposedEnvPrefixes: ["NEXT_PUBLIC_", "VITE_"],
    safePatterns: [
      "match /databases/{database}/documents { match /users/{userId} { allow read, write: if request.auth.uid == userId; } }",
    ],
    unsafePatterns: [
      "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }",
    ],
    recommendedPatterns: [
      "Restricted Security Rules per collection based on request.auth.",
    ],
    knownMistakes: [
      "Setting Firestore rules to `allow read, write: if true;` during tutorial setup and shipping to production.",
    ],
  },
};

export const PROVIDER_KNOWLEDGE_BASE: Record<string, ProviderKnowledgeItem> = {
  supabase: {
    id: "supabase",
    displayName: "Supabase",
    safeKeys: ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"],
    unsafeKeys: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_DB_PASSWORD"],
    rotationUrl: "https://supabase.com/dashboard/project/_/settings/api",
    docsUrl: "https://supabase.com/docs/guides/api/api-keys",
  },
  openai: {
    id: "openai",
    displayName: "OpenAI",
    safeKeys: [],
    unsafeKeys: ["OPENAI_API_KEY", "OPENAI_SECRET_KEY"],
    rotationUrl: "https://platform.openai.com/api-keys",
    docsUrl: "https://platform.openai.com/docs/safety-best-practices",
  },
  anthropic: {
    id: "anthropic",
    displayName: "Anthropic",
    safeKeys: [],
    unsafeKeys: ["ANTHROPIC_API_KEY"],
    rotationUrl: "https://console.anthropic.com/settings/keys",
    docsUrl: "https://docs.anthropic.com/en/docs/initial-setup",
  },
  stripe: {
    id: "stripe",
    displayName: "Stripe",
    safeKeys: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "VITE_STRIPE_PUBLISHABLE_KEY", "STRIPE_PUBLISHABLE_KEY"],
    unsafeKeys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    rotationUrl: "https://dashboard.stripe.com/apikeys",
    docsUrl: "https://stripe.com/docs/keys",
  },
  aws: {
    id: "aws",
    displayName: "Amazon Web Services (AWS)",
    safeKeys: [],
    unsafeKeys: ["AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"],
    rotationUrl: "https://console.aws.amazon.com/iam/home#/security_credentials",
    docsUrl: "https://docs.aws.amazon.com/general/latest/gr/aws-access-keys-best-practices.html",
  },
};

export const OWASP_MAPPING = {
  A01_BROKEN_ACCESS_CONTROL: {
    id: "A01:2021",
    name: "Broken Access Control",
    cwe: ["CWE-284", "CWE-285", "CWE-639"],
    url: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
  },
  A02_CRYPTOGRAPHIC_FAILURES: {
    id: "A02:2021",
    name: "Cryptographic Failures",
    cwe: ["CWE-327", "CWE-798", "CWE-328"],
    url: "https://owasp.org/Top10/A02_2021-Cryptographic_Failures/",
  },
  A03_INJECTION: {
    id: "A03:2021",
    name: "Injection",
    cwe: ["CWE-79", "CWE-89", "CWE-94", "CWE-78"],
    url: "https://owasp.org/Top10/A03_2021-Injection/",
  },
  A04_INSECURE_DESIGN: {
    id: "A04:2021",
    name: "Insecure Design",
    cwe: ["CWE-209", "CWE-522"],
    url: "https://owasp.org/Top10/A04_2021-Insecure_Design/",
  },
  A05_SECURITY_MISCONFIGURATION: {
    id: "A05:2021",
    name: "Security Misconfiguration",
    cwe: ["CWE-16", "CWE-942", "CWE-1059"],
    url: "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/",
  },
  A07_IDENTIFICATION_AUTHENTICATION_FAILURES: {
    id: "A07:2021",
    name: "Identification and Authentication Failures",
    cwe: ["CWE-287", "CWE-384", "CWE-613"],
    url: "https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/",
  },
  A08_SOFTWARE_DATA_INTEGRITY_FAILURES: {
    id: "A08:2021",
    name: "Software and Data Integrity Failures",
    cwe: ["CWE-829", "CWE-494"],
    url: "https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/",
  },
  A10_SSRF: {
    id: "A10:2021",
    name: "Server-Side Request Forgery (SSRF)",
    cwe: ["CWE-918"],
    url: "https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/",
  },
};
